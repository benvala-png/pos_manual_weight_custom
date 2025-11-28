from odoo import models, fields

class PosConfig(models.Model):
    _inherit = 'pos.config'

    x_min_weight_grams = fields.Float(
        string="Poids minimum (g)",
        help="Poids minimum autorisé pour la saisie manuelle.",
        default=0.0,
    )
    x_max_weight_grams = fields.Float(
        string="Poids maximum (g)",
        help="Poids maximum autorisé pour la saisie manuelle.",
        default=0.0,
    )
    x_enable_weight_note = fields.Boolean(
        string="Note de poids sur la ligne",
        help="Ajoute une note avec le poids sur la ligne de ticket.",
        default=True,
    )
