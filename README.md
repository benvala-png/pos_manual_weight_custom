POS Manual Weight (Custom) — Module Odoo 16

Module Odoo permettant la saisie manuelle du poids directement depuis le Point de Vente (PoS), avec des options avancées : poids minimum / maximum, saisie en grammes, validation automatique, ajout de notes, etc.

🚀 Fonctionnalités principales

🔢 Saisie manuelle du poids via une fenêtre popup dans le PdV

⚖️ Poids en grammes (g)

🛑 Blocage si poids inférieur au minimum

🟩 Blocage si poids supérieur au maximum

📝 Ajout automatique d’une note sur la ligne de ticket (poids saisi)

🔐 Paramètres configurables par PdV :

Poids minimum

Poids maximum

Note sur ligne de ticket (oui/non)



🖼️ Démo rapide

Lorsqu’un produit "Pesable" est ajouté :

1. Une popup s’ouvre automatiquement


2. L’utilisateur encode le poids (en grammes)


3. Vérification des limites min/max


4. Le PoS met à jour la quantité au prorata du poids


5. Une note peut être ajoutée sur la ligne (ex : “Poids saisi : 326 g”)



⚙️ Installation

1. Copier le module dans vos custom addons

/opt/odoo/odoo16/custom_addons/pos_manual_weight_custom

2. Vérifier que le chemin est présent dans odoo.conf

addons_path = /opt/odoo/odoo16/addons,/opt/odoo/odoo16/custom_addons

3. Redémarrer Odoo

sudo systemctl restart odoo

4. Aller dans :

Point de Vente → Configuration → Point de Vente → (Votre PdV)
Activer les options du module.

🔧 Configuration

Paramètres dans le PdV

Poids minimum (g) : ex. 10

Poids maximum (g) : ex. 10 000

Note sur ligne : cochez pour ajouter “Poids : X g”


📁 Structure du module

pos_manual_weight_custom/
│-- __manifest__.py
│-- __init__.py
│-- models/
│   └── pos_config.py
│-- static/
│   └── js/
│       └── manual_weight.js
│-- views/
│   └── pos_config_view.xml
│   └── pos_weight_popup.xml

🛠️ Fonctionnement technique

Étend pos.config pour ajouter les champs min/max + option note

Injecte une popup JavaScript dans l’interface PoS

Override de la méthode d’ajout de produits pour forcer la saisie du poids

Conversion g → kg (divisé par 1000) avant calcul Odoo

Ajout facultatif d’une note via orderline.set_note()


🧪 Compatibilité

✔️ Odoo 16

✔️ Point de Vente (Frontend OWL)

❌ Non compatible Offline (mode IoT déconnecté)


🤝 Contribution

Pull requests bienvenues !
Pour toute amélioration, bugfix ou suggestion :
👉 Issues GitHub directement sur ce dépôt.

📄 Licence

Ce module est publié sous licence MIT (à adapter selon ton choix).

