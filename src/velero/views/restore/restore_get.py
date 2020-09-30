from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.utils import velero

profile = Blueprint("restore_get", __name__)


@profile.route("/restore/get")
def index():
    list = velero("restore get")
    # current_app.logger.error(f"Backup list: {list}")
    return jsonify(list)
