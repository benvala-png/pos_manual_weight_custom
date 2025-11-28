{
    'name': 'POS Manual Weight (Custom)',
    'version': '16.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Manual weight entry for POS items marked as to_weight',
    'author': 'ChatGPT + Benjamin',
    'license': 'LGPL-3',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_view.xml',
    ],
    'assets': {
        'point_of_sale.assets': [
            'pos_manual_weight_custom/static/src/js/manual_weight.js',
        ],
    },
    'installable': True,
}
