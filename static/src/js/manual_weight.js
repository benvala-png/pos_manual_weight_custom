/** @odoo-module **/

const ProductScreen = require('point_of_sale.ProductScreen');
const Registries = require('point_of_sale.Registries');

const SCALE_URL        = "http://100.81.17.17:8073/weight";
const FETCH_TIMEOUT    = 1000;  // ms — garde-fou JS (proxy répond déjà en < 500ms)
const MAX_MANUAL_GRAMS = 50000; // 50 kg — plafond anti faute de frappe

const isLocalNetwork = window.location.hostname.includes('localhost') ||
                       window.location.hostname.startsWith('192.168') ||
                       window.location.hostname.startsWith('127');

console.log("POS MODULE LOADED:", new Date().toLocaleString());

/**
 * Retourne le poids (float) ou null.
 * - HTTP 200 → poids live
 * - HTTP 503 / timeout / erreur réseau → null (saisie manuelle)
 */
async function getWeightFromScale() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const t0 = performance.now();

    try {
        console.log("SCALE CALL →", SCALE_URL, "|", new Date().toLocaleTimeString());
        const response = await fetch(SCALE_URL, { signal: controller.signal });
        clearTimeout(timer);
        const elapsed = Math.round(performance.now() - t0);

        if (!response.ok) {
            console.log(`Scale unavailable — HTTP ${response.status} (${elapsed} ms)`);
            return null;
        }

        const data = await response.json();
        console.log(`SCALE RESPONSE (${elapsed} ms):`, data);

        const weight = parseFloat(data.weight);
        return isNaN(weight) ? null : weight;

    } catch (error) {
        clearTimeout(timer);
        const elapsed = Math.round(performance.now() - t0);
        console.log(`Scale error (${elapsed} ms):`, error.name === "AbortError" ? "timeout 1s" : error);
        return null;
    }
}

const ManualWeightProductScreen = (ProductScreen) =>
class extends ProductScreen {

    async _clickProduct(event) {
        try {
            const product = event.detail;
            console.log("CLICK PRODUCT:", product.display_name, "|", new Date().toLocaleTimeString());

            if (product.to_weight && isLocalNetwork) {
                // Réseau local → interroge la balance
                const weightKg = await getWeightFromScale();
                console.log("WEIGHT RESULT:", weightKg, "kg |", new Date().toLocaleTimeString());

                // Balance connectée → ajout direct (pas de popup)
                if (weightKg && weightKg > 0) {
                    this.env.pos.get_order().add_product(product, { quantity: weightKg });
                    return;
                }

                // Balance indisponible (503 / timeout) → saisie manuelle en grammes
                console.log("SCALE UNAVAILABLE — manual input");
                while (true) {
                    const { confirmed, payload } = await this.showPopup('NumberPopup', {
                        title: "Poids (g)",
                        startingValue: 0,
                        isInputSelected: true,
                    });
                    if (!confirmed) return;
                    const manualGrams = parseFloat(payload);
                    if (isNaN(manualGrams) || manualGrams <= 0) return;
                    if (manualGrams < MAX_MANUAL_GRAMS) {
                        this.env.pos.get_order().add_product(product, { quantity: manualGrams / 1000 });
                        return;
                    }
                    await this.showPopup('ErrorPopup', {
                        title: "Poids invalide",
                        body: `${manualGrams}g dépasse le maximum autorisé (${MAX_MANUAL_GRAMS / 1000}kg).`,
                    });
                }

            } else if (product.to_weight) {
                // GSM / réseau distant → popup direct, zéro appel balance
                console.log("REMOTE DEVICE — manual input (no scale call)");
                while (true) {
                    const { confirmed, payload } = await this.showPopup('NumberPopup', {
                        title: "Poids (g)",
                        startingValue: 0,
                        isInputSelected: true,
                    });
                    if (!confirmed) return;
                    const manualGramsRemote = parseFloat(payload);
                    if (isNaN(manualGramsRemote) || manualGramsRemote <= 0) return;
                    if (manualGramsRemote < MAX_MANUAL_GRAMS) {
                        this.env.pos.get_order().add_product(product, { quantity: manualGramsRemote / 1000 });
                        return;
                    }
                    await this.showPopup('ErrorPopup', {
                        title: "Poids invalide",
                        body: `${manualGramsRemote}g dépasse le maximum autorisé (${MAX_MANUAL_GRAMS / 1000}kg).`,
                    });
                }
            }

            return super._clickProduct(event);

        } catch (err) {
            console.error("POS ERROR:", err);
        }
    }
};

Registries.Component.extend(ProductScreen, ManualWeightProductScreen);

export default ManualWeightProductScreen;
