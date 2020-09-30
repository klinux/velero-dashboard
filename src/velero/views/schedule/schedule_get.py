from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.utils import velero

profile = Blueprint("schedule_get", __name__)


@profile.route("/schedule/get")
def index():
    list = velero("schedule get")
    # current_app.logger.error(f"Backup list: {list}")
    return jsonify(list)
