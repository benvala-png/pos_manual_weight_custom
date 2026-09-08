# pos_manual_weight_custom (Odoo 16)

Addon Odoo 16 pour la saisie du poids dans le Point de Vente. Quand la
caissière clique sur un produit vendu au poids, le module interroge d'abord
la balance connectée en HTTP ; si elle ne répond pas, une popup de saisie
manuelle s'ouvre (en grammes).

---

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| Lecture automatique de la balance | Appel HTTP local (`http://localhost:5000/weight`), ajout direct de la ligne si un poids valide est renvoyé |
| Repli en saisie manuelle | Popup en grammes si la balance ne répond pas (503, timeout, erreur réseau) |
| Détection réseau local / distant | Sur un poste hors réseau local (GSM, tablette distante), aucun appel balance n'est tenté : saisie manuelle directe |
| Plafond anti faute de frappe | 50 kg — au-delà, message d'erreur et nouvelle saisie demandée |

---

## Installation

1. Copier le dossier `pos_manual_weight_custom` dans un répertoire présent dans `addons_path` (dépend de `point_of_sale`, inclus dans Odoo)
2. Redémarrer Odoo, aucune session POS ouverte
3. **Apps > Mettre à jour la liste des applications**
4. Rechercher `POS Manual Weight (Custom)` et cliquer sur **Installer**

Le script de lecture de la balance (Flask, sur le **poste de caisse
lui-même**, port 5000) est un composant séparé, hors de ce module — voir
`static/tools/README.md` pour le démarrage automatique au boot Windows
(`setup_balance_autostart.ps1`).

---

## Logique

### La chaîne balance

`http://localhost:5000/weight` — un script Flask tournant **sur le poste de
caisse**. Avant le 19/08/2026, la lecture passait par un relais sur le Pi
« ben » (`100.81.17.17:8073`) ; le Pi s'étant éteint sans que la panne soit
visible, la lecture a été ramenée en local.

Deux formats de réponse coexistent et sont acceptés tous les deux : texte
brut (`"0.0000"`, le script actuel) ou JSON (`{"weight": 0.0, ...}`, l'ancien
relais). La réponse est toujours lue en texte puis parsée en tolérant les
deux — **piège identifié le 19/08/2026** : `JSON.parse("0.0000")` réussit et
renvoie `0`, un poids nul silencieux si on avait fait confiance au JSON sans
repli sur `parseFloat`.

### Réseau local vs distant

`isLocalNetwork` teste le nom d'hôte de la page (`localhost`, `192.168.*`,
`127.*`). Sur un poste identifié comme distant, aucun appel balance n'est
tenté — évite un timeout d'une seconde à chaque clic produit sur un usage
mobile où il n'y a de toute façon pas de balance à joindre.

### Arrondi du poids

**Non géré par ce module.** L'arrondi observé (10 g au lieu de 1 g) vient de
la configuration Odoo standard — `uom.rounding` **et** `decimal.precision`
(le plus grossier des deux gagne, via un `Math.max` côté Odoo) — pas de ce
JS ni de la balance. À corriger côté configuration des unités de mesure si le
symptôme réapparaît.

---

## Champs ajoutés

### `pos.config`

| Champ | Type | Description |
|---|---|---|
| `x_min_weight_grams` | Float | Poids minimum autorisé en saisie manuelle |
| `x_max_weight_grams` | Float | Poids maximum autorisé en saisie manuelle |
| `x_enable_weight_note` | Boolean | Ajoute une note avec le poids sur la ligne de ticket |

---

## Piège connu : ces trois champs ne sont pas branchés

Le formulaire de configuration POS (**Point de Vente → Configuration →
Point de Vente**, groupe « Poids manuel ») affiche bien
`x_min_weight_grams`, `x_max_weight_grams` et `x_enable_weight_note`, mais
`manual_weight.js` ne les lit **jamais** : le plafond réellement appliqué est
la constante `MAX_MANUAL_GRAMS = 50000` codée en dur, il n'y a pas de
vérification de minimum, et aucune note n'est ajoutée à la ligne de ticket
quoi que vaille `x_enable_weight_note`. Modifier ces champs depuis
l'interface n'a donc aucun effet observable. À corriger dans le JS avant de
s'appuyer dessus, ou à retirer si la config par produit/point de vente n'est
finalement pas nécessaire.

---

## Structure du module

```
pos_manual_weight_custom/
├── __init__.py
├── __manifest__.py
├── models/
│   └── pos_config.py             # Champs de configuration (non lus par le JS, voir piège)
├── views/
│   └── pos_config_view.xml       # Groupe « Poids manuel » sur la fiche point de vente
└── static/
    ├── src/
    │   ├── js/manual_weight.js         # Appel balance, popup manuelle, plafond en dur
    │   └── xml/manual_weight_popup.xml
    └── tools/
        ├── README.md                    # Démarrage automatique du script balance (Windows)
        └── setup_balance_autostart.ps1
```

---

## Licence

LGPL-3
