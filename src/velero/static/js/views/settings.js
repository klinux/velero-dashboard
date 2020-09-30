$(document).ready(function() {

    /*
     * Get backup numbers
     */

    let $num_backups = $("#num_backups");
    let $num_backups_status = $("#num_backups_status");

    $num_backups.addClass("d-none");
    $num_backups_status.removeClass("d-none");

    $.ajax({
        url: "/backup/get",
        type: "GET",
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        success: function(response) {

            let backup_count = 0;

            if (response.items) {
                backup_count = Object.keys(response.items).length;
            } else {
                backup_count = 1;
            }

            $num_backups_status.addClass("d-none");
            $num_backups.removeClass("d-none");
            $num_backups.text(backup_count);

        },
        error: function(error) {
            console.log("GET COUNT BACKUP: Error ocorred when try to get number of backups.", error);
        }
    });

    /*
     * Get restores numbers
     */

    let $num_restores = $("#num_restores");
    let $num_restores_status = $("#num_restores_status");

    $num_restores.addClass("d-none");
    $num_restores_status.removeClass("d-none");

    $.ajax({
        url: "/restore/get",
        type: "GET",
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        success: function(response) {

            let restores_count = 0;

            if (response.items) {
                restores_count = Object.keys(response.items).length;
            } else {
                restores_count = 1;
            }

            $num_restores_status.addClass("d-none");
            $num_restores.removeClass("d-none");
            $num_restores.text(restores_count);

        },
        error: function(error) {
            console.log("GET COUNT RESTORES: Error ocorred when try to get number of restores.", error);
        }
    });

    /*
     * Get schedules numbers
     */

    let $num_schedules = $("#num_schedules");
    let $num_schedules_status = $("#num_schedules_status");

    $num_schedules.addClass("d-none");
    $num_schedules_status.removeClass("d-none");

    $.ajax({
        url: "/schedule/get",
        type: "GET",
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        success: function(response) {

            let schedules_count = 0;

            if (response.items) {
                schedules_count = Object.keys(response.items).length;
            } else {
                schedules_count = 1;
            }

            $num_schedules_status.addClass("d-none");
            $num_schedules.removeClass("d-none");
            $num_schedules.text(schedules_count);

        },
        error: function(error) {
            console.log("GET COUNT SCHEDULES: Error ocorred when try to get number of shecdules.", error);
        }
    });

});