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
        var subjectsFolders = {};
        for(var i = 0; i < scans.length; i++) {
            subject_id = scans[i]['meta.subject_id'];
            if(!(subject_id in subjects)) {
                var dob = new Date(scans[i]['meta.dob']);
                subjects[subject_id] = {'dob': dob,
                    'sex': scans[i]['meta.sex'],
                    'collectionId': scans[i]['baseParentId'],
                    'folderId': scans[i]['parentId'],
                    'scans': [] };
                if(earliestDOB === null || dob < earliestDOB) {
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
            if(latestScan === null || scanDate > latestScan) {
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
        var NUM_WEIGHT_BINS = 8;
        var bin_size = weight_range/NUM_WEIGHT_BINS;
        var bin_start = min_weight;
        var bin_end = min_weight + bin_size;
        var weightBinRanges = [];
        var taskStatuses = {'dob': 'birth'};
        for(var i = 0; i < NUM_WEIGHT_BINS; i++) {
            var bin = 'scan-weight-' + (i+1);
            weightBinRanges.push({'bin': bin, 'start': bin_start, 'end': bin_end });
            bin_start = bin_end;
            bin_end += bin_size;
            // add a status for each bin, so that each bin gets a separate color
            taskStatuses[bin] = bin;
        }
        var maxScanAgeDays = null;
        var msToDayConv = 1000 * 60 * 60 * 24; // 1000 ms/s 60 s/m 60 m/h 24 h/d
        for(var i = 0; i < subject_ids.length; i++) {
            var subject_id = subject_ids[i];
            var subject = subjects[subject_id];
            var dob_start = subject['dob'];
            var dob_end = new Date(dob_start);
            dob_end.setHours(dob_end.getHours() + 24);
            subjectid_to_dob[subject_id] = dob_start;
            var dob_task = {'folderId': subject['folderId'], 'collectionId': subject['collectionId'], "startDate": dob_start, "endDate": dob_end, "taskName": subject_id, "status": "dob"};
            subjectsFolders[subject_id] = subject['folderId'];
            tasks.push(dob_task);
            var scans = subject['scans'];
            var firstScanDays = null;
            for(var j = 0; j < scans.length; j++) {
                var scan_start = scans[j]['date'];
                var scan_end = new Date(scan_start); scan_end.setHours(scan_end.getHours() + 24);
                var scan_weight = scans[j]['weight'];
                // bin weight
                var normalized = (scan_weight - min_weight) / weight_range;
                var rounded = Math.round(normalized * NUM_WEIGHT_BINS);
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
                if(firstScanDays === null) {
                    firstScanDays = scanAgeDays;
                }
                firstScanDays = Math.min(firstScanDays, scanAgeDays);
                subject['firstScanDays'] = firstScanDays;
            }
        }
        // remove dob events
        var normalizedTasks = _.filter(tasks, function (task) {
            return task.status !== 'dob';
        });
        // sort by first scan date
        subject_ids.sort(function(a, b) {
            var firstScanA = subjects[a]['firstScanDays'],
                firstScanB = subjects[b]['firstScanDays'];
            return (firstScanA > firstScanB) - (firstScanA < firstScanB);
        });
        var gantt = {
            'subject_ids': subject_ids,
            'tasks': tasks,
            'taskStatuses': taskStatuses,
            'timeDomain': timeDomain,
            'normalizedTasks': normalizedTasks,
            'linearDomain': [0, maxScanAgeDays],
            'weightBinRanges': weightBinRanges,
            'subjectsFolders': subjectsFolders
        };
        return gantt;
    },

    initialize: function (settings) {
        this.model = settings.model;
        this.hierarchyUpdateCallback = function(folderId) {
            var folder = new girder.models.FolderModel();
            folder.set({
                _id: folderId
            }).on('g:fetched', function () {
                settings.parentView.hierarchyWidget.breadcrumbs = [folder];
                settings.parentView.hierarchyWidget._fetchToRoot(folder);
                settings.parentView.hierarchyWidget.setCurrentModel(folder, {setRoute: false});
            }, this).on('g:error', function () {
                console.log('error fetching folder with id '+folderId);
            }, this).fetch();
        };
        this.render();
    },

    render: function() {
        var infoPage = this.model.get('monkeybrainsInfoPage');
        var infopageMarkdownContainer;
        if (infoPage) {
            infopageMarkdownContainer = $('.g-collection-infopage-markdown');
            girder.renderMarkdown(infoPage, infopageMarkdownContainer);
        }

        var id = this.model.get('_id');
        girder.restRequest({
            path: 'collection/' + id + '/datasetEvents',
            type: 'GET',
            error: null // TODO an error handler, is this the same as .error below
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
                'normalizedTasks': ganttData.normalizedTasks,
                'subjectsFolders': ganttData.subjectsFolders
            };
            var gantt = d3.gantt('.g-collection-infopage-gantt', settings, this.hierarchyUpdateCallback);
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
        $('.g-collection-header').after(girder.templates.collection_infopage());
        this.infoPageWidget = new girder.views.monkeybrains_InfoPageWidget({
            model: this.model,
            access: this.access,
            parentView: this,
            el: $('.g-collection-infopage')
        });
    }
    return this;
});
