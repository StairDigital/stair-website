"""Local dev server for the STAIR site.

Plain `python -m http.server` lets the browser cache the HTML documents, so
edits to *.html appear not to take effect even after a hard refresh (the ?v=
stamps on CSS/JS cannot bust the document itself). This serves the same folder
but tells the browser never to store anything.
"""
import http.server
import os
import socketserver

PORT = 8760
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    # a 304 would defeat the point: always answer with the current bytes.
    # self.headers is an email.message.Message, so use del, not pop.
    def send_head(self):
        for header in ("If-Modified-Since", "If-None-Match"):
            while header in self.headers:
                del self.headers[header]
        return super().send_head()


if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), NoCacheHandler) as httpd:
        print("serving %s on http://localhost:%d (no-cache)" % (ROOT, PORT))
        httpd.serve_forever()
