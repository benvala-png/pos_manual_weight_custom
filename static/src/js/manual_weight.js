/** @odoo-module **/

const ProductScreen = require('point_of_sale.ProductScreen');
const Registries = require('point_of_sale.Registries');

const DEFAULT_MIN_GRAMS = 10;
const DEFAULT_MAX_GRAMS = 100000;  // 100 kg par défaut si rien n'est configuré

const ManualWeightProductScreen = (ProductScreen) =>
    class extends ProductScreen {
        async _clickProduct(event) {
            if (!this.currentOrder) {
                this.env.pos.add_new_order();
            }

            const product = event.detail;

            // 👉 Popup uniquement pour les produits "À peser avec une balance"
            if (product.to_weight) {
                const config = this.env.pos.config || {};
                const minGrams = config.x_min_weight_grams || DEFAULT_MIN_GRAMS;
                const maxGrams = config.x_max_weight_grams || DEFAULT_MAX_GRAMS;
                const enableNote = !!config.x_enable_weight_note;

                const { confirmed, payload } = await this.showPopup('NumberPopup', {
                    title: this.env._t('Poids NET en grammes'),
                    startingValue: 0,
                    isInputSelected: true,
                });

                if (!confirmed || !payload) {
                    return; // annulé
                }

                let grams = parseFloat(payload.toString().replace(',', '.')) || 0;
                grams = Math.round(grams);

                // 🔻 Contrôle mini
                if (grams < minGrams) {
                    await this.showPopup('ErrorPopup', {
                        title: this.env._t('Poids trop faible'),
                        body: this.env._t(
                            `Poids saisi : ${grams} g.\nPoids minimum accepté : ${minGrams} g.`
                        ),
                    });
                    return;
                }

                // 🔺 Contrôle maxi
                if (grams > maxGrams) {
                    await this.showPopup('ErrorPopup', {
                        title: this.env._t('Poids trop élevé'),
                        body: this.env._t(
                            `Poids saisi : ${grams} g.\nPoids maximum autorisé : ${maxGrams} g.`
                        ),
                    });
                    return;
                }

                // conversion g -> kg pour Odoo (produit configuré en kg)
                const quantity = grams / 1000.0;

                await this._addProduct(product, { quantity });

                // 📝 Note automatique sur la ligne (si activée et méthode dispo)
                const order = this.currentOrder;
                const lastLine = order && order.get_last_orderline();
                if (lastLine && enableNote && typeof lastLine.set_note === 'function') {
                    lastLine.set_note(`${grams} g`);
                }

                return;
            }

            // 👉 Produits normaux → comportement POS standard
            return super._clickProduct(event);
        }
    };

Registries.Component.extend(ProductScreen, ManualWeightProductScreen);

export default ManualWeightProductScreen;
