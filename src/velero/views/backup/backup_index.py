from flask import Blueprint, render_template, current_app, request, jsonify, session, flash, redirect, url_for, g
from datetime import datetime
from velero.utils import velero

profile = Blueprint("backup_index", __name__)
date_format = "%Y-%m-%dT%H:%M:%SZ"


@profile.route("/backups", methods=["GET"])
def index():
    list = velero("backup get")

    backup_list = []
    backup_dict = {}

    if "items" in list:
        for item in list["items"]:
            backup_dict = {}
            for k, v in item.items():
                if k == "metadata":
                    for meta, mvalue in v.items():
                        if meta == "name":
                            backup_dict[meta] = mvalue
                        if meta == "creationTimestamp":
                            backup_dict[meta] = mvalue
                            c_time = datetime.strptime(mvalue, date_format)
                if k == "status":
                    for status, svalue in v.items():
                        if status == "phase" or status == "errors" or status == "warnings":
                            backup_dict[status] = svalue
                        if status == "expiration":
                            e_time = datetime.strptime(svalue, date_format)
                            delta = (e_time - c_time)
                            backup_dict[status] = f"{delta.days - 1}d"
                if k == "spec":
                    for spec, pvalue in v.items():
                        if spec == "storageLocation" or spec == "selector":
                            backup_dict[spec] = pvalue
            current_app.logger.error(f"dict {backup_dict}")
            backup_list.append(backup_dict)
        current_app.logger.error(f"key {backup_list}")
    else:
        for k, v in list.items():
            if k == "metadata":
                for meta, mvalue in v.items():
                    if meta == "name":
                        backup_dict[meta] = mvalue
                    if meta == "creationTimestamp":
                        backup_dict[meta] = mvalue
                        c_time = datetime.strptime(mvalue, date_format)
            if k == "status":
                for status, svalue in v.items():
                    if status == "phase" or status == "errors" or status == "warnings":
                        backup_dict[status] = svalue
                    if status == "expiration":
                        e_time = datetime.strptime(svalue, date_format)
                        delta = (e_time - c_time)
                        backup_dict[status] = f"{delta.days - 1}d"
            if k == "spec":
                for spec, pvalue in v.items():
                    if spec == "storageLocation" or spec == "selector":
                        backup_dict[spec] = pvalue

        backup_list.append(backup_dict)
    
    # current_app.logger.error(f"key {backup_list}")
    return render_template("backup/index.html", backups=backup_list, user=g.user, page="backup")
