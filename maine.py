"""
ProofLingo - main window (Tkinter)

Pages:
  1. Products       add / edit / delete the products to check (saved to products.csv)
  2. Run TrustMap   opens the AI app (app.py) in its own window
  3. Results        colour-coded TrustMap results from the last run
  4. Quit

Run:  python main.py
"""

import os
import subprocess
import sys
import tempfile
import tkinter as tk
from tkinter import messagebox, ttk

import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_CSV = os.path.join(BASE_DIR, "products.csv")
RESULTS_CSV = os.path.join(BASE_DIR, "trustmap_results.csv")
APP_FILE = os.path.join(BASE_DIR, "app.py")
PORT = 8765  # own port, so an old Streamlit app on 8501 can't be opened by mistake
PRODUCT_COLUMNS = ["Product", "Description", "Evidence"]

BLUE, GREEN, RED, GREY = "#158aff", "#4CAF50", "#ff6b6b", "#c3c3c3"
STATUS_COLOURS = {"Supported": "#d4edda", "Lacks evidence": "#fff3cd", "Needs expert review": "#f8d7da"}

DEMO_PRODUCTS = [
    {"Product": "Rosehip Glow Serum",
     "Description": "Visibly brightens skin in 4 weeks. Clinically proven to reduce wrinkles by 40%. "
                    "Made with cold-pressed rosehip oil.",
     "Evidence": "Independent clinical study, 30 participants, 2025: brightness improved after 4 weeks. "
                 "Rosehip oil listed in EU CosIng as Rosa Canina Fruit Oil."},
    {"Product": "Calm Barrier Moisturiser",
     "Description": "Moisturises for up to 24 hours. Heals eczema and dermatitis. Chemical-free and non-toxic.",
     "Evidence": "Corneometer consumer test, 20 participants: hydration up to 24 hours. Customer case reports."},
    {"Product": "Clear Skin Gel",
     "Description": "Helps reduce the appearance of blemishes. Permanently eliminates spots. "
                    "Dermatologically tested.",
     "Evidence": "Self-assessment study, 25 participants: appearance of blemishes reduced. "
                 "Dermatologically tested by Dermatest, report 2025. Internal lab notes on spots."},
]

streamlit_process = None  # so we only start the AI server once

root = tk.Tk()
root.geometry("1000x700")
root.title("ProofLingo")


def load_products():
    if os.path.exists(PRODUCTS_CSV):
        return pd.read_csv(PRODUCTS_CSV).fillna("")
    df = pd.DataFrame(DEMO_PRODUCTS, columns=PRODUCT_COLUMNS)
    df.to_csv(PRODUCTS_CSV, index=False)
    return df


def page_title(frame, text):
    tk.Label(frame, text=text, font=("Bold", 26)).pack(pady=(15, 5))


# ---------------------------------------------------------------------------
# Page 1: Products
# ---------------------------------------------------------------------------
def products_page():
    frame = tk.Frame(main_frame)
    page_title(frame, "Products")
    tk.Label(frame, text="Add the products you want to sell abroad, with their claims and any evidence.",
             font=("Arial", 11)).pack()

    df = load_products()
    tree = ttk.Treeview(frame, columns=PRODUCT_COLUMNS, show="headings", height=12)
    for col, width in zip(PRODUCT_COLUMNS, (180, 350, 350)):
        tree.heading(col, text=col, anchor=tk.W)
        tree.column(col, anchor=tk.W, width=width)
    for _, row in df.iterrows():
        tree.insert("", "end", values=[row[c] for c in PRODUCT_COLUMNS])

    def product_form(item=None):
        """One window for adding and editing, with all three fields."""
        values = tree.item(item)["values"] if item else ["", "", ""]
        win = tk.Toplevel(frame)
        win.title("Edit product" if item else "Add product")
        win.geometry("520x420")

        tk.Label(win, text="Product name", font=("Arial", 10)).pack(anchor=tk.W, padx=15, pady=(10, 0))
        name = tk.Entry(win, font=("Arial", 10), width=60)
        name.insert(0, values[0])
        name.pack(padx=15)

        boxes = []
        for label, value in (("Description (the claims you make)", values[1]),
                             ("Evidence (studies, test reports, official sources)", values[2])):
            tk.Label(win, text=label, font=("Arial", 10)).pack(anchor=tk.W, padx=15, pady=(10, 0))
            box = tk.Text(win, font=("Arial", 10), width=60, height=6, wrap=tk.WORD)
            box.insert("1.0", value)
            box.pack(padx=15)
            boxes.append(box)

        def save():
            new = [name.get().strip(), boxes[0].get("1.0", tk.END).strip(), boxes[1].get("1.0", tk.END).strip()]
            if not new[0] or not new[1]:
                messagebox.showwarning("Missing details", "Add a product name and description.", parent=win)
                return
            if item:
                tree.item(item, values=new)
            else:
                tree.insert("", "end", values=new)
            save_products(quiet=True)
            win.destroy()

        tk.Button(win, text="Save product", command=save, bg=BLUE, fg="white",
                  font=("Bold", 10), padx=15).pack(pady=12)

    def edit_selected():
        if not tree.selection():
            messagebox.showwarning("Select a product", "Click a product first, then Edit.")
            return
        product_form(tree.selection()[0])

    def delete_selected():
        if not tree.selection():
            messagebox.showwarning("Select a product", "Click a product first, then Delete.")
            return
        tree.delete(tree.selection()[0])
        save_products(quiet=True)

    def save_products(quiet=False):
        rows = [tree.item(i)["values"] for i in tree.get_children()]
        pd.DataFrame(rows, columns=PRODUCT_COLUMNS).to_csv(PRODUCTS_CSV, index=False)
        if not quiet:
            messagebox.showinfo("Saved", f"{len(rows)} products saved.")

    def reset_demo():
        if messagebox.askyesno("Load demo", "Replace your products with the 3 skincare demo products?"):
            tree.delete(*tree.get_children())
            for p in DEMO_PRODUCTS:
                tree.insert("", "end", values=[p[c] for c in PRODUCT_COLUMNS])
            save_products(quiet=True)

    buttons = tk.Frame(frame)
    buttons.pack(pady=10, fill=tk.X, padx=10)
    for text, cmd, colour in (("Add product", product_form, BLUE), ("Edit selected", edit_selected, BLUE),
                              ("Delete selected", delete_selected, RED), ("Save", save_products, GREEN),
                              ("Load demo products", reset_demo, "#777777")):
        tk.Button(buttons, text=text, command=cmd, bg=colour, fg="white", font=("Bold", 10),
                  padx=12, pady=6).pack(side=tk.LEFT, padx=4)

    tree.bind("<Double-1>", lambda e: edit_selected())
    tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    frame.pack(fill=tk.BOTH, expand=True)


# ---------------------------------------------------------------------------
# Page 2: Run TrustMap (opens app.py)
# ---------------------------------------------------------------------------
def run_page():
    frame = tk.Frame(main_frame)
    page_title(frame, "Run TrustMap")
    n = len(load_products())
    tk.Label(frame, text=f"{n} products ready to check.\n\n"
                         "The AI reads each description, finds every claim, checks it against your evidence\n"
                         "and the target market's rules, then gives each claim a probability and each product\n"
                         "a trust score. Choose the target market in the TrustMap window.",
             font=("Arial", 11), justify=tk.CENTER).pack(pady=15)

    status = tk.Label(frame, text="", font=("Arial", 10), fg="#555555")

    def launch():
        open_ai_app()
        status.config(text="TrustMap is opening in a new window. "
                           "When it's finished, come back to the Results page.")

    tk.Button(frame, text="Open TrustMap", command=launch, bg=BLUE, fg="white",
              font=("Bold", 14), padx=25, pady=10).pack(pady=10)
    status.pack()
    frame.pack(fill=tk.BOTH, expand=True)


def open_ai_app():
    """Start app.py with Streamlit (once) and show it in a pywebview window."""
    global streamlit_process
    # Make sure the app.py next to main.py is the ProofLingo one, not the old analysis assistant
    try:
        with open(APP_FILE, encoding="utf-8") as f:
            app_code = f.read()
    except FileNotFoundError:
        messagebox.showerror("app.py not found", f"There is no app.py in:\n{BASE_DIR}\n\n"
                             "Put the ProofLingo app.py in the same folder as main.py.")
        return
    if "ProofLingo TrustMap" not in app_code:
        messagebox.showerror("Old app.py found",
                             f"This app.py is the old AI Data Analysis Assistant:\n{APP_FILE}\n\n"
                             "Replace it with the ProofLingo app.py, then press Open TrustMap again.")
        return

    if streamlit_process is None or streamlit_process.poll() is not None:
        streamlit_process = subprocess.Popen(
            [sys.executable, "-m", "streamlit", "run", APP_FILE, "--server.headless=true", f"--server.port={PORT}",
             "--logger.level=error", "--client.showErrorDetails=false"],
            cwd=BASE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait until the server answers instead of guessing with a fixed sleep
    webview_script = f"""
import time, urllib.request
import webview
for _ in range(60):
    try:
        urllib.request.urlopen('http://localhost:{PORT}', timeout=1)
        break
    except Exception:
        time.sleep(0.5)
webview.create_window('ProofLingo TrustMap', 'http://localhost:{PORT}', width=1100, height=800)
webview.start()
"""
    script_path = os.path.join(tempfile.gettempdir(), "prooflingo_webview.py")
    with open(script_path, "w") as f:
        f.write(webview_script)
    subprocess.Popen([sys.executable, script_path])


# ---------------------------------------------------------------------------
# Page 3: Results
# ---------------------------------------------------------------------------
def results_page():
    frame = tk.Frame(main_frame)
    page_title(frame, "Results")

    if not os.path.exists(RESULTS_CSV):
        tk.Label(frame, text="No results yet. Go to Run TrustMap, check your products,\n"
                             "then come back here.", font=("Arial", 12)).pack(pady=30)
        frame.pack(fill=tk.BOTH, expand=True)
        return

    df = pd.read_csv(RESULTS_CSV).fillna("")

    # Trust score per product
    summary = tk.Frame(frame)
    summary.pack(pady=5)
    for product, group in df.groupby("product", sort=False):
        score = int(group["trust_score"].iloc[0])
        colour = "#2e7d32" if score >= 75 else "#b8860b" if score >= 50 else "#c62828"
        box = tk.Frame(summary, highlightbackground=colour, highlightthickness=2, padx=12, pady=6)
        tk.Label(box, text=product, font=("Arial", 10)).pack()
        tk.Label(box, text=f"{score}/100", font=("Bold", 20), fg=colour).pack()
        tk.Label(box, text=group["band"].iloc[0], font=("Arial", 9)).pack()
        box.pack(side=tk.LEFT, padx=6)

    columns = ["Product", "Status", "P(ok)", "Claim"]
    tree = ttk.Treeview(frame, columns=columns, show="headings", height=12)
    for col, width in zip(columns, (170, 150, 60, 480)):
        tree.heading(col, text=col, anchor=tk.W)
        tree.column(col, anchor=tk.W, width=width)
    for status, colour in STATUS_COLOURS.items():
        tree.tag_configure(status, background=colour)

    rows = {}
    for _, r in df.iterrows():
        item = tree.insert("", "end", tags=(r["status"],),
                           values=(r["product"], r["status"], f"{float(r['probability']):.0%}", r["claim"]))
        rows[item] = r

    def show_details(event=None):
        if not tree.selection():
            return
        r = rows[tree.selection()[0]]
        reasons = "\n".join(f"• {x}" for x in str(r["reasons"]).split(" | ") if x)
        ai = "-" if r["ai_probability"] == "" else f"{float(r['ai_probability']):.0%}"
        messagebox.showinfo(
            r["status"],
            f"{r['claim']}\n\nProbability: {float(r['probability']):.0%} "
            f"(rules {float(r['rule_probability']):.0%}, AI {ai})\n"
            f"Evidence: {r['evidence']}\n\nWhy:\n{reasons}\n\n"
            f"Safer wording:\n{r['safer_wording']}\n\nLocalised:\n{r['localised']}")

    tree.bind("<Double-1>", show_details)
    tk.Label(frame, text="Double-click a claim to see why, the safer wording and the translation.",
             font=("Arial", 9), fg="#555555").pack(pady=(8, 0))
    tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    tk.Button(frame, text="Refresh", command=lambda: indicate(results_indicate, results_page),
              bg=BLUE, fg="white", font=("Bold", 10), padx=15).pack(pady=(0, 10))
    frame.pack(fill=tk.BOTH, expand=True)


# ---------------------------------------------------------------------------
# Page 4: Quit
# ---------------------------------------------------------------------------
def quit_page():
    frame = tk.Frame(main_frame)
    page_title(frame, "Quit")
    tk.Button(frame, text="Exit ProofLingo", command=quit_app, bg=RED, fg="white",
              font=("Bold", 12), padx=20).pack(pady=20)
    frame.pack(pady=20)


def quit_app():
    if streamlit_process is not None and streamlit_process.poll() is None:
        streamlit_process.terminate()  # don't leave the AI server running
    root.destroy()


# ---------------------------------------------------------------------------
# Sidebar navigation (same pattern as before)
# ---------------------------------------------------------------------------
def delete_pages():
    for frame in main_frame.winfo_children():
        frame.destroy()


def indicate(lb, page):
    for ind in indicators:
        ind.config(bg=GREY)
    lb.config(bg=BLUE)
    delete_pages()
    page()


options_frame = tk.Frame(root, bg=GREY)
tk.Label(options_frame, text="ProofLingo", font=("Bold", 20), fg=BLUE, bg=GREY).place(x=15, y=10)

indicators = []
for i, (text, page) in enumerate((("1. Products", products_page), ("2. Run TrustMap", run_page),
                                  ("3. Results", results_page), ("4. Quit", quit_page))):
    y = 70 + i * 50
    ind = tk.Label(options_frame, text="", bg=GREY)
    ind.place(x=3, y=y, width=5, height=40)
    indicators.append(ind)
    tk.Button(options_frame, text=text, font=("Bold", 15), fg=BLUE, bd=0, bg=GREY,
              command=lambda ind=ind, page=page: indicate(ind, page)).place(x=10, y=y)

products_indicate, run_indicate, results_indicate, quit_indicate = indicators

options_frame.pack(side=tk.LEFT, fill=tk.Y)
options_frame.configure(width=210, height=700)

main_frame = tk.Frame(root, highlightbackground="black", highlightthickness=2)
main_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

root.protocol("WM_DELETE_WINDOW", quit_app)
indicate(products_indicate, products_page)  # open on the Products page
root.mainloop()