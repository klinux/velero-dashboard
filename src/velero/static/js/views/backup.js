$(document).ready(function () {
    /*
     * Turn on datatable
     */
    $('#data-backup').DataTable({
        "paging": true,
        "ordering": true,
        "info": true,
        "pagingType": 'simple_numbers',
        "lengthMenu": [10, 50, 100, 200]
    });

    $('#confirm-delete').on('show.bs.modal', function (e) {
        if (!e) {
            return e.preventDefault();
        } else {
            let btn_accept = $(this).find("#confirm-accept");

            $(btn_accept).on("click", function (data) {
                let url = "/backup/delete/" + $(e.relatedTarget).data('href');
                window.location.href = url;
            });
        }
    });

    $tags_ids = ["#exclude-namespaces", "#include-namespaces", "#exclude-resources", "#include-resources"]

    for (names in $tags_ids) {
        $($tags_ids[names]).selectize({
            delimiter: ",",
            persist: true,
            create: function (input) {
                return {
                    value: input,
                    text: input
                }
            },
            plugins: ["remove_button", "restore_on_backspace"],
        });
    }

});

/*
 * Get describe backup
 */
function modal_describe(backup) {
    $.ajax({
        url: "/backup/describe/" + backup,
        type: "GET",
        dataType: 'text',
        contentType: "text/plain; charset=utf-8",
        success: function (response) {
            $('#modal-describe').modal('show');

            let describe_text = $("#describe-text");
            let backup_name = $("#backup-name");

            describe_text.text(response);
            backup_name.html(backup);
        },
        error: function (error) {
            console.log("GET Describe: it's not possible to get describe backup.", error);
        }
    });
}

/*
 * Get logs backup
 */
function modal_logs(backup) {
    $.ajax({
        url: "/backup/logs/" + backup,
        type: "GET",
        dataType: 'text',
        contentType: "text/plain; charset=utf-8",
        success: function (response) {
            $('#modal-logs').modal('show');

            let logs_text = $("#logs-text");
            let backup_name = $("#backup-log-name");

            logs_text.text(response);
            backup_name.html(backup);
        },
        error: function (error) {
            console.log("GET Logs: it's not possible to get describe backup.", error);
        }
    });
}