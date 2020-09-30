from os import environ

from flask import Blueprint, redirect, url_for
from flask_oidc import OpenIDConnect

profile = Blueprint("auth", __name__, url_prefix="/")
oidc = OpenIDConnect()


@profile.route("/login")
@oidc.require_login
def login():
    """
    Objetivo: Forcar o usuario a autenticar e com sucesso ira para o home.
    """
    return redirect(url_for("home.index"))


@profile.route("/logout")
def logout():
    """
    Objetivo: Efetuar logout.
    """
    oidc.logout()
    return redirect(url_for("home.index"))
