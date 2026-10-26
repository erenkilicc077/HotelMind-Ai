"""Windows-friendly entry point: choose a free loopback port and open the UI."""
import argparse
import socket
import threading
import webbrowser
import uvicorn


def available_port(start):
    for port in range(start,start+11):
        with socket.socket() as sock:
            try:sock.bind(('127.0.0.1',port))
            except OSError:continue
            return port
    raise RuntimeError('No free port in the requested range. Close a previous HotelMind server.')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8000);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
    port=available_port(args.port)
    url=f'http://127.0.0.1:{port}/'
    print(f'HotelMind AI v0.2: {url}\nKeep this terminal open. Press Ctrl+C to stop.',flush=True)
    if not args.no_browser:
        timer=threading.Timer(1.5,lambda:webbrowser.open(url));timer.daemon=True;timer.start()
    uvicorn.run('hotelmind.api:app',host='127.0.0.1',port=port)

if __name__=='__main__':main()
