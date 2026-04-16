/** @odoo-module **/

const ProductScreen = require('point_of_sale.ProductScreen');
const Registries = require('point_of_sale.Registries');

// 🔥 LOG AU CHARGEMENT
console.log("POS MODULE LOADED:", new Date().toLocaleString());

async function getWeightFromScale() {
    try {
        const response = await fetch("http://100.67.124.17:5000/weight");

        const text = await response.text();

        console.log("RAW WEIGHT:", text, "|", new Date().toLocaleTimeString());

        const weight = parseFloat(text);

        if (!isNaN(weight)) {
            return weight;
        }

    } catch (error) {
        console.log("Scale error:", error);
    }

    return null;
}

const ManualWeightProductScreen = (ProductScreen) =>
class extends ProductScreen {

    async _clickProduct(event) {
        try {
            const product = event.detail;

            console.log("CLICK PRODUCT:", product.display_name, "|", new Date().toLocaleTimeString());

            if (product.to_weight) {

                const weight = await getWeightFromScale();

                console.log("WEIGHT TEST:", weight, "|", new Date().toLocaleTimeString());

                // ✅ balance OK
                if (weight && weight > 0) {
                    console.log("ADDING PRODUCT WITH WEIGHT:", weight);

                    this.env.pos.get_order().add_product(product, {
                        quantity: weight
                    });
                    return;
                }

                console.log("FALLBACK MANUAL");

                const { confirmed, payload } = await this.showPopup('NumberPopup', {
                    title: "Poids (kg)",
                    startingValue: 0,
                    isInputSelected: true,
                });

                if (!confirmed) {
                    return;
                }

                const manualWeight = parseFloat(payload);

                if (!isNaN(manualWeight) && manualWeight > 0) {
                    this.env.pos.get_order().add_product(product, {
                        quantity: manualWeight
                    });
                }

                return;
            }

            return super._clickProduct(event);

        } catch (err) {
            console.error("POS ERROR:", err);
        }
    }
};

Registries.Component.extend(ProductScreen, ManualWeightProductScreen);

export default ManualWeightProductScreen;
