import CollectionView from '@girder/core/views/body/CollectionView';
import FolderModel from '@girder/core/models/FolderModel';
import { renderMarkdown } from '@girder/core/misc';
import { restRequest } from '@girder/core/rest';
import View from '@girder/core/views/View';
import { wrap } from '@girder/core/utilities/PluginUtils'; 

import CollectionInfopageTemplate from './templates/collectionInfopage.pug';
import EditCollectionInfopageTemplate from './templates/editCollectionInfopage.pug';
import EditCollectionWidget from '@girder/core/views/widgets/EditCollectionWidget';

import './stylesheets/longitude.styl';
import './stylesheets/infopage.styl';

import "./longitude-d3.js";

wrap(EditCollectionWidget, 'render', function (render) {
    var view, monkeybrains, infoPage;
    view = this;
    render.call(view);
    if (view.model) {
        monkeybrains = view.model.get('monkeybrains');
        if (monkeybrains) {
            $('.g-validation-failed-message').before(EditCollectionInfopageTemplate);
            infoPage = view.model.get('monkeybrainsInfoPage');
            if (infoPage && infoPage !== '') {
                view.$('#g-collection-infopage-edit').val(infoPage);
            }
        }
    }

    return view;
});

wrap(EditCollectionWidget, '_saveCollection', function (_saveCollection, fields) {
    var infoPage;
    infoPage = this.$('#g-collection-infopage-edit').val();
    fields.monkeybrainsInfoPage = infoPage;
    return _saveCollection.call(this, fields);
});

var InfoPageWidget = View.extend({

    createLongitudeInput: function (scans) {
        // data munging
        // create a set of subjects with scans
        // calculate limit values of dataset
        var earliestDOB = null,
            latestScan = null,
            max_weight = null,
            min_weight = null,
            subjects = {},
            subjectsFolders = {},
            i = 0,
            subject_id = null,
            dob = null;
        for (i = 0; i < scans.length; i = i + 1) {
            subject_id = scans[i]['meta.subject_id'];
            if (!(subject_id in subjects)) {
                dob = new Date(scans[i]['meta.dob']);
                subjects[subject_id] = {
                    dob: dob,
                    sex: scans[i]['meta.sex'],
                    collectionId: scans[i].baseParentId,
                    folderId: scans[i].parentId,
                    scans: []
                };
                if (earliestDOB === null || dob < earliestDOB) {
                    earliestDOB = dob;
                }
            }
            var scanDate = new Date(scans[i]['meta.scan_date']);
            var weight = scans[i]['meta.scan_weight_kg'];
            subjects[subject_id].scans.push({
                date: scanDate,
                sex: scans[i]['meta.sex'],
                weight: weight,
                collectionId: scans[i].baseParentId,
                parentFolderId: scans[i].parentId,
                folderId: scans[i]._id
            });
            if (latestScan === null || scanDate > latestScan) {
                latestScan = scanDate;
            }
            max_weight = Math.max(max_weight, weight);
            if (min_weight === null) {
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
        // create 'tasks' from the dates
        // change a DOB and a scan to be 1 day long, so they have some width
        var tasks = [];
        var subjectid_to_dob = {};
        var weight_range = max_weight - min_weight;
        var NUM_WEIGHT_BINS = 8;
        var bin_size = weight_range / NUM_WEIGHT_BINS;
        var bin_start = min_weight;
        var bin_end = min_weight + bin_size;
        var weightBinRanges = [];
        var taskStatuses = {dob: 'birth'};
        for (i = 0; i < NUM_WEIGHT_BINS; i = i + 1) {
            var bin = 'scan-weight-' + (i + 1);
            weightBinRanges.push({bin: bin, start: bin_start, end: bin_end });
            bin_start = bin_end;
            bin_end += bin_size;
            // add a status for each bin, so that each bin gets a separate color
            taskStatuses[bin] = bin;
        }
        var maxScanAgeDays = null;
        var msToDayConv = 1000 * 60 * 60 * 24; // 1000 ms/s 60 s/m 60 m/h 24 h/d
        for (i = 0; i < subject_ids.length; i = i + 1) {
            subject_id = subject_ids[i];
            var subject = subjects[subject_id];
            var dob_start = subject.dob;
            var dob_end = new Date(dob_start);
            dob_end.setHours(dob_end.getHours() + 24);
            subjectid_to_dob[subject_id] = dob_start;
            var dob_task = {
                sex: subject.sex,
                folderId: subject.folderId,
                collectionId: subject.collectionId,
                startDate: dob_start,
                endDate: dob_end,
                taskName: subject_id,
                status: 'dob'
            };
            subjectsFolders[subject_id] = subject.folderId;
            tasks.push(dob_task);
            var subjectScans = subject.scans;
            var firstScanDays = null;
            for (var j = 0; j < subjectScans.length; j = j + 1) {
                var scan_start = subjectScans[j].date;
                var scan_end = new Date(scan_start); scan_end.setHours(scan_end.getHours() + 24);
                var scan_weight = subjectScans[j].weight;
                // bin weight
                var normalized = (scan_weight - min_weight) / weight_range;
                var rounded = Math.round(normalized * NUM_WEIGHT_BINS);
                rounded = Math.max(rounded, 1);
                var status = 'scan-weight-' + rounded;
                // normalize scan events to be relative to DOB
                dob = subjectid_to_dob[subject_id];
                var scanOffsetMS = scan_start - dob;
                var scanAgeDays = scanOffsetMS / msToDayConv;
                maxScanAgeDays = Math.max(maxScanAgeDays, scanAgeDays);
                var scan_task = {
                    sex: subject.sex,
                    startDate: scan_start,
                    endDate: scan_end,
                    taskName: subject_id,
                    scanWeight: scan_weight,
                    status: status,
                    scanAge: scanAgeDays,
                    collectionId: subjectScans[j].collectionId,
                    parentFolderId: subjectScans[j].parentFolderId,
                    folderId: subjectScans[j].folderId
                };
                tasks.push(scan_task);
                if (firstScanDays === null) {
                    firstScanDays = scanAgeDays;
                }
                firstScanDays = Math.min(firstScanDays, scanAgeDays);
                subject.firstScanDays = firstScanDays;
            }
        }
        // remove dob events
        var normalizedTasks = _.filter(tasks, function (task) {
            return task.status !== 'dob';
        });
        // sort by first scan date
        subject_ids.sort(function (a, b) {
            var firstScanA = subjects[a].firstScanDays,
                firstScanB = subjects[b].firstScanDays;
            return (firstScanA < firstScanB) - (firstScanA > firstScanB);
        });
        var longitude = {
            subject_ids: subject_ids,
            tasks: tasks,
            taskStatuses: taskStatuses,
            timeDomain: timeDomain,
            normalizedTasks: normalizedTasks,
            linearDomain: [0, maxScanAgeDays],
            weightBinRanges: weightBinRanges,
            subjectsFolders: subjectsFolders
        };
        return longitude;
    },

    initialize: function (settings) {
	this.model = settings.model;
        this.hierarchyUpdateCallback = function (folderId) {
            var folder = new FolderModel();
            folder.set({
                _id: folderId
            }).on('g:fetched', function () {
                settings.parentView.hierarchyWidget.breadcrumbs = [folder];
                settings.parentView.hierarchyWidget._fetchToRoot(folder);
                settings.parentView.hierarchyWidget.setCurrentModel(folder, {setRoute: false});
            }, this).on('g:error', function () {
                console.log('error fetching folder with id ' + folderId);
            }, this).fetch();
        };
        this.render();
    },

    render: function () {
        var infoPage = this.model.get('monkeybrainsInfoPage');
        var infopageMarkdownContainer;

        if (infoPage) {
            infopageMarkdownContainer = $('.g-collection-infopage-markdown');
            renderMarkdown(infoPage, infopageMarkdownContainer);
        }

        var id = this.model.get('_id');
        restRequest({
            url: 'collection/' + id + '/datasetEvents',
            method: 'GET'
        }).done(_.bind(function (resp) {
            var longitudeData = this.createLongitudeInput(resp);
            var settings = {
                mode: 'linear',
                rowLabels: longitudeData.subject_ids,
                timeDomainMode: 'fixed',
                timeDomain: longitudeData.timeDomain,
                taskStatuses: longitudeData.taskStatuses,
                weightBinRanges: longitudeData.weightBinRanges,
                linearDomain: longitudeData.linearDomain,
                tasks: longitudeData.tasks,
                normalizedTasks: longitudeData.normalizedTasks,
                subjectsFolders: longitudeData.subjectsFolders
            };
            var longitude = d3.longitude('.g-collection-infopage-longitude', settings, this.hierarchyUpdateCallback);
            // display longitude chart in scan age display to start
            longitude('linear');
        }, this)).error(_.bind(function (err) {
            console.log('error getting datasetEvents');
            console.log(err);
        }, this));
    }
});

wrap(CollectionView, 'render', function (render) {
    render.call(this);
    if (this.model.get('monkeybrains')) {
        $('.g-collection-header').after(CollectionInfopageTemplate);
	this.infoPageWidget = new InfoPageWidget({
            model: this.model,
            access: this.access,
            parentView: this,
            el: $('.g-collection-infopage')
        });
    }
    return this;
});
