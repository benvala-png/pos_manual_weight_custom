{
    'name': 'POS Manual Weight (Custom)',
    'version': '16.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Saisie manuelle du poids (en grammes) pour les articles vendus au poids dans le Point de Vente',
    'description': """
POS Manual Weight (Custom)
==========================

Ce module ajoute une fenêtre de saisie du poids (en grammes) lors de l’ajout d’un produit au poids dans le Point de Vente.

Fonctionnalités
---------------
- Pop-up de saisie du poids (g)
- Poids minimum et maximum configurables
- Validation automatique + blocage des valeurs hors limites
- Note du poids ajoutée sur la ligne de ticket (optionnel)
- Compatible avec Odoo 16 Community et Enterprise

""",
    'author': 'Benjamin + ChatGPT',
    'website': 'https://github.com/benvala-png/pos_manual_weight_custom',
    'license': 'LGPL-3',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_view.xml',
    ],
    'assets': {
        'point_of_sale.assets': [
            'pos_manual_weight_custom/static/src/js/manual_weight.js',
            'pos_manual_weight_custom/static/src/xml/manual_weight_popup.xml',
        ],
    },
    'installable': True,
    'application': False,
}
