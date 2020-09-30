from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from velero.utils import velero_str

profile = Blueprint("backup_delete", __name__)


@profile.route("/backup/delete/<backup>", methods=["GET"])
def delete(backup):
    if request.method == "GET":
        str = velero_str(f"backup delete {backup} --confirm")
        if "submitted successfully" in str:
            flash(f"Backup successful delete", "success")
        else:
            flash(f"Backup cannot be deleted", "error")

    # current_app.logger.error(f"Backup list: {str}")
    return redirect(url_for('backup_index.index'))
