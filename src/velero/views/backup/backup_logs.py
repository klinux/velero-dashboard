from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.utils import velero_str

profile = Blueprint("backup_logs", __name__)


@profile.route("/backup/logs/<backup>")
def logs(backup):
    str = velero_str(f"backup logs {backup}")
    # current_app.logger.error(f"Backup list: {list}")
    return str
