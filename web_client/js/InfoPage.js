girder.views.monkeybrains_InfoPageWidget = girder.View.extend({

   createGanttInput: function (scans) {
        // data munging
        // create a set of subjects with scans
        // calculate limit values of dataset
        var earliestDOB = null;
        var latestScan = null;
        var max_weight = null;
        var min_weight = null;
        var subjects = {};
        for(var i = 0; i < scans.length; i++) {
            subject_id = scans[i]['meta.subject_id'];
            if(!(subject_id in subjects)) {
                var dob = new Date(scans[i]['meta.dob']);
                subjects[subject_id] = {'dob': dob,
                    'sex': scans[i]['meta.sex'],
                    'collectionId': scans[i]['baseParentId'],
                    'folderId': scans[i]['parentId'],
                    'scans': [] };
                if(earliestDOB == null || dob < earliestDOB) {
                    earliestDOB = dob;
                }
            }
            var scanDate = new Date(scans[i]['meta.scan_date']);
            var weight = scans[i]['meta.scan_weight_kg'];
            subjects[subject_id]['scans'].push(
                {'date': scanDate,
                'weight': weight,
                'collectionId': scans[i]['baseParentId'],
                'parentFolderId': scans[i]['parentId'],
                'folderId': scans[i]['_id']});
            if(latestScan == null || scanDate > latestScan) {
                latestScan = scanDate;
            }
            max_weight = Math.max(max_weight, weight);
            if(min_weight === null) {
                min_weight = max_weight;
            }
            min_weight = Math.min(min_weight, weight);
        }
        var subject_ids = Object.keys(subjects);
        // set the time domain to one month before the earliest DOB and one month after the last scan
        var timeDomain = [];
        var startDate = new Date(earliestDOB);
        startDate.setMonth(startDate.getMonth() - 1);
        timeDomain.push(startDate);
        var endDate = new Date(latestScan);
        endDate.setMonth(endDate.getMonth() - 1);
        timeDomain.push(endDate);
        // create "tasks" from the dates
        // change a DOB and a scan to be 1 day long, so they have some width
        var tasks = [];

        var subjectid_to_dob = {};
        var weight_range = max_weight - min_weight;
        var bin_size = weight_range/8;
        var bin_start = min_weight;
        var bin_end = min_weight + bin_size;
        var weightBinRanges = [];
        for(var i = 0; i < 8; i++) {
            var bin = 'scan-weight-' + (i+1);
            weightBinRanges.push({'bin': bin, 'start': bin_start, 'end': bin_end });
            bin_start = bin_end;
            bin_end += bin_size;
        }
        var maxScanAgeDays = null;
        var msToDayConv = 1000 * 60 * 60 * 24;
        for(var i = 0; i < subject_ids.length; i++) {
            var subject_id = subject_ids[i];
            var subject = subjects[subject_id];
            var dob_start = subject['dob'];
            var dob_end = new Date(dob_start);
            dob_end.setHours(dob_end.getHours() + 24);
            subjectid_to_dob[subject_id] = dob_start;
            var dob_task = {'folderId': subject['folderId'], 'collectionId': subject['collectionId'], "startDate": dob_start, "endDate": dob_end, "taskName": subject_id, "status": "dob"};
            tasks.push(dob_task);
            var scans = subject['scans'];
            for(var j = 0; j < scans.length; j++) {
                var scan_start = scans[j]['date'];
                var scan_end = new Date(scan_start); scan_end.setHours(scan_end.getHours() + 24);
                var scan_weight = scans[j]['weight'];
                // bin weight between 1 and 8
                var normalized = (scan_weight - min_weight) / weight_range;
                var rounded = Math.round(normalized*8);
                rounded = Math.max(rounded, 1);
                var status = 'scan-weight-' + rounded;
                // normalize scan events to be relative to DOB
                var dob = subjectid_to_dob[subject_id];
                var scanOffsetMS = scan_start - dob;
                var scanAgeDays = scanOffsetMS / msToDayConv;
                maxScanAgeDays = Math.max(maxScanAgeDays, scanAgeDays);
                var scan_task = {
                    "startDate": scan_start,
                    "endDate": scan_end,
                    "taskName": subject_id,
                    "scanWeight": scan_weight,
                    "status": status,
                    "scanAge": scanAgeDays,
                    'collectionId': scans[j]['collectionId'],
                    'parentFolderId': scans[j]['parentFolderId'],
                    'folderId': scans[j]['folderId']
                };
                tasks.push(scan_task);
            }
        }
        // remove dob events
        var normalizedTasks = _.filter(tasks, function (task) {
            return task.status !== 'dob';
        });
        var taskStatuses = {'dob': 'birth',
                            'scan-weight-1': 'scan-weight-1',
                            'scan-weight-2': 'scan-weight-2',
                            'scan-weight-3': 'scan-weight-3',
                            'scan-weight-4': 'scan-weight-4',
                            'scan-weight-5': 'scan-weight-5',
                            'scan-weight-6': 'scan-weight-6',
                            'scan-weight-7': 'scan-weight-7',
                            'scan-weight-8': 'scan-weight-8'};
        // sort subject_ids lexicographically
        subject_ids.sort(function(a, b) {
            return a.localeCompare(b);
        });
        var gantt = {
            'subject_ids': subject_ids,
            'tasks': tasks,
            'taskStatuses': taskStatuses,
            'timeDomain': timeDomain,
            'normalizedTasks': normalizedTasks,
            'linearDomain': [0, maxScanAgeDays],
            'weightBinRanges': weightBinRanges
        };
        return gantt;
    },

    initialize: function (settings) {
        this.model = settings.model;
        $('.g-collection-header').after(girder.templates.collection_infopage());
        this.infoPageContainer = $('.g-collection-infopage-markdown');
        this.render();
    },

    render: function() {
        var infoPage = this.model.get('monkeybrainsInfoPage');
        if (infoPage && infoPage !== '') {
            girder.renderMarkdown(infoPage, this.infoPageContainer);
        }

        var id = this.model.get('_id');
        girder.restRequest({
            path: 'collection/' + id + '/datasetEvents',
            type: 'GET',
            error: null
        }).done(_.bind(function (resp) {
            ganttData = this.createGanttInput(resp);
            var settings = {
                'rowLabels': ganttData.subject_ids,
                'timeDomainMode': 'fixed',
                'timeDomain': ganttData.timeDomain,
                'taskStatuses': ganttData.taskStatuses,
                'weightBinRanges': ganttData.weightBinRanges,
                'linearDomain': ganttData.linearDomain,
                'tasks': ganttData.tasks,
                'normalizedTasks': ganttData.normalizedTasks
            };
            var gantt = d3.gantt('.g-collection-infopage-gantt', settings);
            // display gantt chart in calendar mode to start
            gantt('time');
        }, this)).error(_.bind(function (err) {
            console.log("error getting datasetEvents");
            console.log(err);
        }, this));
     }

});

girder.wrap(girder.views.CollectionView, 'render', function(render) {
    render.call(this);
    if (this.model.get('monkeybrains')) {
        this.infoPageWidget = new girder.views.monkeybrains_InfoPageWidget({
            model: this.model,
            access: this.access,
            parentView: this
        });
    }
    return this;
});
