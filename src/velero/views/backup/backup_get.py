from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.utils import velero

profile = Blueprint("backup_get", __name__)


@profile.route("/backup/get")
def index():
    list = velero("backup get")
    # current_app.logger.error(f"Backup list: {list}")
    return jsonify(list)
