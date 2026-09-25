"""
scale_server.py — lit la balance du comptoir et l'expose sur http://<poste>:5000/weight

Tourne sur le PC de caisse (tâche planifiée « IPELLE-Balance-POS », voir
pos_manual_weight_custom/static/tools/). La caisse Odoo interroge cette URL
quand un article « au poids » est cliqué ; toute réponse <= 0 la fait basculer
en saisie manuelle des grammes.

─────────────────────────────────────────────────────────────────────────────
CE QUI A MOTIVÉ LA RÉÉCRITURE DE LA LECTURE (2026-09-12)

La balance refuse de peser au-delà de 3 kg et affiche alors « Err 8.3 ».
L'ancienne lecture était :

    match = re.search(r"([0-9]+[.,]?[0-9]*)", buffer)

soit « le premier nombre trouvé n'importe où dans la trame ». Sur « Err 8.3 »
elle renvoyait donc 8.3, et la caisse l'ajoutait comme 8,3 kg de marchandise.
Ticket Shop/3481 du 10/09/2026 : 8,300 kg de bananes à 24,24 € facturés à une
cliente dont toutes les autres lignes étaient à 1. Personne ne s'en est aperçu.

Le principe retenu est donc : **en cas de doute, ne rien annoncer**. Renvoyer
« 0 » ne coûte qu'une saisie manuelle ; renvoyer un mauvais poids coûte de
l'argent à un client et ne laisse aucune trace.

Les trois garde-fous ci-dessous ne peuvent que REFUSER une lecture : une trame
normale traverse exactement comme avant, sans changement de comportement.
"""
from flask import Flask
from flask_cors import CORS
import serial
import time
import re

app = Flask(__name__)
CORS(app)  # suffisant, pas besoin de gérer OPTIONS à la main

# Portée de la balance. Aucune lecture au-dessus ne peut être vraie : si elle
# ne sait pas peser 4 kg, elle ne peut pas en annoncer 8.
CAPACITE_KG = 3.0

# Ce que la balance affiche quand elle ne pèse pas. « err » couvre « Err 8.3 » ;
# « ol » / « o-l » sont les surcharges des autres protocoles, mis là par avance
# parce qu'ils coûtent une ligne et qu'on ne les verra qu'un jour de panne.
ERREURS = re.compile(r"err|o-?l\b|-{3,}", re.IGNORECASE)

# Le signe fait partie du nombre : sans lui, « -0.5 » ressortait « 0.5 ».
NOMBRE = re.compile(r"([+-]?[0-9]+[.,]?[0-9]*)")

ser = serial.Serial(
    port='COM1',
    baudrate=9600,
    bytesize=serial.EIGHTBITS,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_TWO,
    timeout=0.3
)


def lire_trame(buffer):
    """Poids (str) lu dans une trame, ou « 0 » si elle n'est pas exploitable.

    Séparé de la liaison série pour être testable sans balance branchée :
        python -c "import scale_server as s; print(s.lire_trame('Err 8.3'))"
    """
    if not buffer or not buffer.strip():
        return "0"

    if ERREURS.search(buffer):
        print("REJET: la balance annonce une erreur ->", repr(buffer))
        return "0"

    for m in NOMBRE.finditer(buffer):
        # Un nombre collé derrière un mot n'est pas un poids, c'est un code.
        # C'est ce qui distingue « Err 8.3 » d'une trame « ST,GS,  1.234kg »,
        # où le nombre suit une virgule ou un espace.
        avant = buffer[:m.start()].rstrip()
        if avant and avant[-1].isalpha():
            print("REJET: nombre précédé d'un mot ->", repr(buffer))
            continue

        brut = m.group(1).replace(',', '.')
        try:
            valeur = float(brut)
        except ValueError:
            continue

        if abs(valeur) > CAPACITE_KG:
            print(f"REJET: {valeur} kg hors portée ({CAPACITE_KG} kg) ->",
                  repr(buffer))
            return "0"

        return brut

    print("REJET: aucun poids lisible ->", repr(buffer))
    return "0"


def read_weight():
    try:
        ser.reset_input_buffer()
        ser.write(b'P\r\n')

        time.sleep(0.4)

        buffer = ""
        if ser.in_waiting:
            buffer = ser.read(ser.in_waiting).decode(errors='ignore')

        # repr() et non la chaîne nue : les trames portent des \r, \n et des
        # espaces de cadrage qu'un print normal escamote, alors que ce sont eux
        # qui expliquent une lecture ratée.
        print("RAW:", repr(buffer))

        return lire_trame(buffer)

    except Exception as e:
        print("ERROR:", e)

    return "0"


@app.route('/weight', methods=['GET'])
def weight():
    return read_weight()


if __name__ == "__main__":
    print("Scale server started OK")
    app.run(host='0.0.0.0', port=5000)
