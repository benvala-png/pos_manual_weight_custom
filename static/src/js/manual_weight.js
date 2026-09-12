/** @odoo-module **/

const ProductScreen = require('point_of_sale.ProductScreen');
const Registries = require('point_of_sale.Registries');

const SCALE_URL        = "http://localhost:5000/weight";  // script Flask du poste de caisse (avant : relais du Pi « ben » 100.81.17.17:8073)
const FETCH_TIMEOUT    = 1000;  // ms — garde-fou JS (proxy répond déjà en < 500ms)
const MAX_MANUAL_GRAMS = 50000; // 50 kg — plafond anti faute de frappe
// Portée maximale de la balance. Au-delà elle refuse de peser et affiche une
// erreur ("Err 8.3" le 2026-09-12) — mais le script Flask du poste en extrait
// le nombre et renvoie 8.3, que la caisse ajoutait comme 8,3 kg de
// marchandise. AUCUNE lecture au-dessus de cette portée ne peut être vraie :
// si la balance ne sait pas peser 4 kg, elle ne peut pas en annoncer 8.
const MAX_SCALE_KG     = 3;

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

        // Deux formats coexistent : le script local renvoie du texte brut ("0.0000"),
        // l'ancien relais du Pi du JSON ({"weight":0.0,"unit":"kg",...}). On lit en
        // texte et on accepte les deux, pour que l'URL puisse changer sans casser.
        const raw = (await response.text()).trim();
        console.log(`SCALE RESPONSE (${elapsed} ms):`, raw);

        let weight;
        try {
            const parsed = JSON.parse(raw);
            weight = parseFloat(parsed !== null && typeof parsed === "object" ? parsed.weight : parsed);
        } catch (e) {
            weight = parseFloat(raw);
        }
        if (isNaN(weight)) {
            return null;
        }
        // Hors portée = la balance est en erreur, pas chargée. On rend `null`,
        // donc la caisse bascule en saisie manuelle comme lorsqu'elle est
        // injoignable : mieux vaut faire retaper un poids que d'en facturer un
        // faux.
        if (weight > MAX_SCALE_KG) {
            console.log(`SCALE OUT OF RANGE: ${weight} kg > ${MAX_SCALE_KG} kg `
                        + `— lecture refusée (balance en erreur / surcharge)`);
            return null;
        }
        return weight;

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
