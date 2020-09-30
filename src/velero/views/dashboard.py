from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.auth import oidc

profile = Blueprint("dashboard", __name__)


@profile.route("/")
def index():
    return render_template("dashboard/index.html", user=g.user, page="dashboard")
