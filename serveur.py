"""Serveur local pour le développement du frontend.

    python serveur.py

Ce serveur sert les fichiers statiques du frontend et permet de tester
localement avant de pousser sur GitHub Pages.

Le frontend est conçu pour fonctionner avec n'importe quel serveur HTTP
statique. Ce serveur n'est fourni que pour le développement local.
"""

import http.server
import os
import socketserver
import webbrowser
from pathlib import Path

PORT = 8080
ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        # Silence les logs pour une sortie plus propre
        pass


def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"Serveur démarré sur {url}")
        print("Appuyez sur Ctrl+C pour arrêter.")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServeur arrêté.")


if __name__ == "__main__":
    main()
