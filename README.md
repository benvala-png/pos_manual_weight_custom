# POS Manual Weight Custom

Odoo 16 module for manual weight entry in the Point of Sale interface.

When a cashier clicks a product marked as "sold by weight", the module first attempts to read the weight from a connected HTTP scale. If the scale is unreachable, a manual input popup opens so the cashier can type the weight in kilograms.

## Features

- Automatic scale reading via HTTP endpoint (configurable IP)
- Fallback popup for manual weight entry (kg)
- Configurable minimum and maximum weight per POS configuration
- Optional weight note added to the order line
- Compatible with Odoo 16 Community and Enterprise

## Installation

1. Copy the module into your custom addons directory:

   ```
   /opt/odoo/odoo16/custom_addons/pos_manual_weight_custom
   ```

2. Make sure the path is listed in `odoo.conf`:

   ```ini
   addons_path = /opt/odoo/odoo16/addons,/opt/odoo/odoo16/custom_addons
   ```

3. Restart Odoo:

   ```bash
   sudo systemctl restart odoo
   ```

4. Go to **Point of Sale > Configuration > Point of Sale**, open your POS, and configure the module options.

## Configuration

In the POS settings form (under **Poids manuel**):

| Field | Description |
|---|---|
| Poids minimum (g) | Minimum allowed weight in grams |
| Poids maximum (g) | Maximum allowed weight in grams |
| Note de poids sur la ligne | Append the entered weight as a note on the order line |

## Module Structure

```
pos_manual_weight_custom/
├── __manifest__.py
├── __init__.py
├── models/
│   └── pos_config.py        # Adds min/max weight and note fields to pos.config
├── static/src/
│   ├── js/
│   │   └── manual_weight.js # Overrides product click to trigger scale/popup
│   └── xml/
│       └── manual_weight_popup.xml
└── views/
    └── pos_config_view.xml  # Injects weight fields into POS config form
```

## How It Works

1. `models/pos_config.py` extends `pos.config` with three new fields (`x_min_weight_grams`, `x_max_weight_grams`, `x_enable_weight_note`).
2. `manual_weight.js` overrides `ProductScreen._clickProduct`. For products with `to_weight = true`, it first calls `GET http://<scale-ip>:5000/weight`. If a valid weight is returned it is used directly; otherwise a `NumberPopup` opens for manual entry.
3. The quantity on the order line is set to the weight value (in kg).

## Requirements

- Odoo 16
- `point_of_sale` module

## License

LGPL-3
