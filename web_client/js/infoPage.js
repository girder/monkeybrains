var monkeybrainsPlugin = {
    views: {}
};

monkeybrainsPlugin.views.infoPageWidget = girder.View.extend({

   createGanttInput: function (scans) {
        // data munging
        var subjects = {};
        for(var i = 0; i < scans.length; i++) {
            subject_id = scans[i]['meta.subject_id'];
            if(!(subject_id in subjects)) {
                subjects[subject_id] = {'dob': new Date(scans[i]['meta.DOB']), 'scans': [] };
            }
            subjects[subject_id]['scans'].push({'date': new Date(scans[i]['meta.scan_date']), 'weight': scans[i]['meta.scan_weight_kg']});
        }

        var earliestDOB = null;
        var latestScan = null;
        var subject_ids = Object.keys(subjects);
        var max_weight = null;
        var min_weight = null;
        for(var i = 0; i < subject_ids.length; i++) {
            var subject_id = subject_ids[i];
            var dob = new Date(subjects[subject_id]['dob']);
            if(earliestDOB == null || dob < earliestDOB) {
                earliestDOB = dob;
            }
            for(var j = 0; j < subjects[subject_id]['scans'].length; j++) {
                var scan = new Date(subjects[subject_id]['scans'][j]['date']);
                if(latestScan == null || scan > latestScan) {
                    latestScan = scan;
                }
                var weight = subjects[subject_id]['scans'][j]['weight'];
                max_weight = Math.max(max_weight, weight);
                if(min_weight === null) {
                    min_weight = max_weight;
                }
                min_weight = Math.min(min_weight, weight);
            }
        }

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
            var dob_start = subjects[subject_id]['dob'];
            var dob_end = new Date(dob_start);
            dob_end.setHours(dob_end.getHours() + 24);
            subjectid_to_dob[subject_id] = dob_start;
            var dob_task = {"startDate": dob_start, "endDate": dob_end, "taskName": subject_id, "status": "dob"};
            tasks.push(dob_task);
            var scans = subjects[subject_id]['scans'];
            scans = _.uniq(scans, false, function(obj) {
                return obj.date.toUTCString() + obj.weight;
            });
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
                    "scanAge": scanAgeDays
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
        this.access = settings.access;
        this.model.on('change', function () {
            this.render();
        }, this);
        var id = this.model.get('_id');
        girder.restRequest({
            path: 'collection/' + id + '/infoPage',
            type: 'GET',
            error: null
        }).done(_.bind(function (resp) {
            var infoPage = resp.infoPage;
            if (infoPage && infoPage !== '') {
                $('.g-collection-header').after(girder.templates.collection_infopage());
                var infoPageContainer = $('.g-collection-infopage-markdown');
                girder.renderMarkdown(infoPage, infoPageContainer);

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
                    // display gantt chart in calendar mode
                    gantt('time');
                }, this)).error(_.bind(function (err) {
                    console.log("error getting datasetEvents");
                    console.log(err);
                }, this));
            }
        }, this)).error(_.bind(function (err) {
            console.log("error getting infopage");
            console.log(err);
        }, this));

        this.render();
    },

    render: function() {
    }

});

girder.wrap(girder.views.CollectionView, 'render', function(render) {
    render.call(this);
    this.infoPageWidget = new monkeybrainsPlugin.views.infoPageWidget({
        model: this.model,
        access: this.access,
        parentView: this
    });
    return this;
});
