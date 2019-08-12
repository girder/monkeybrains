import d3 from 'd3';
import _ from 'underscore';

import { renderMarkdown } from '@girder/core/misc';
import FolderModel from '@girder/core/models/FolderModel';
import { restRequest } from '@girder/core/rest';
import View from '@girder/core/views/View';

import CollectionInfopageTemplate from '../templates/collectionInfopage.pug';
import '../stylesheets/collectionInfopage.styl';

const InfoPageWidget = View.extend({
    initialize: function (settings) {
        this.model = settings.model;
        this.render();
    },

    createLongitudeInput: function (scans) {
        // data munging
        // create a set of subjects with scans
        // calculate limit values of dataset
        var earliestDOB = null,
            latestScan = null,
            maxWeight = null,
            minWeight = null,
            subjects = {},
            subjectsFolders = {},
            i = 0,
            subjectId = null,
            dob = null;
        for (i = 0; i < scans.length; i = i + 1) {
            subjectId = scans[i]['meta.subject_id'];
            if (!(subjectId in subjects)) {
                dob = new Date(scans[i]['meta.dob']);
                subjects[subjectId] = {
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
            subjects[subjectId].scans.push({
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
            maxWeight = Math.max(maxWeight, weight);
            if (minWeight === null) {
                minWeight = maxWeight;
            }
            minWeight = Math.min(minWeight, weight);
        }
        var subjectIds = Object.keys(subjects);
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
        var subjectidToDob = {};
        var weightRange = maxWeight - minWeight;
        var NUM_WEIGHT_BINS = 8;
        var binSize = weightRange / NUM_WEIGHT_BINS;
        var binStart = minWeight;
        var binEnd = minWeight + binSize;
        var weightBinRanges = [];
        var taskStatuses = { dob: 'birth' };
        for (i = 0; i < NUM_WEIGHT_BINS; i = i + 1) {
            var bin = 'scan-weight-' + (i + 1);
            weightBinRanges.push({ bin: bin, start: binStart, end: binEnd });
            binStart = binEnd;
            binEnd += binSize;
            // add a status for each bin, so that each bin gets a separate color
            taskStatuses[bin] = bin;
        }
        var maxScanAgeDays = null;
        var msToDayConv = 1000 * 60 * 60 * 24; // 1000 ms/s 60 s/m 60 m/h 24 h/d
        for (i = 0; i < subjectIds.length; i = i + 1) {
            subjectId = subjectIds[i];
            var subject = subjects[subjectId];
            var dobStart = subject.dob;
            var dobEnd = new Date(dobStart);
            dobEnd.setHours(dobEnd.getHours() + 24);
            subjectidToDob[subjectId] = dobStart;
            var dobTask = {
                sex: subject.sex,
                folderId: subject.folderId,
                collectionId: subject.collectionId,
                startDate: dobStart,
                endDate: dobEnd,
                taskName: subjectId,
                status: 'dob'
            };
            subjectsFolders[subjectId] = subject.folderId;
            tasks.push(dobTask);
            var subjectScans = subject.scans;
            var firstScanDays = null;
            for (var j = 0; j < subjectScans.length; j = j + 1) {
                var scanStart = subjectScans[j].date;
                var scanEnd = new Date(scanStart); scanEnd.setHours(scanEnd.getHours() + 24);
                var scanWeight = subjectScans[j].weight;
                // bin weight
                var normalized = (scanWeight - minWeight) / weightRange;
                var rounded = Math.round(normalized * NUM_WEIGHT_BINS);
                rounded = Math.max(rounded, 1);
                var status = 'scan-weight-' + rounded;
                // normalize scan events to be relative to DOB
                dob = subjectidToDob[subjectId];
                var scanOffsetMS = scanStart - dob;
                var scanAgeDays = scanOffsetMS / msToDayConv;
                maxScanAgeDays = Math.max(maxScanAgeDays, scanAgeDays);
                var scanTask = {
                    sex: subject.sex,
                    startDate: scanStart,
                    endDate: scanEnd,
                    taskName: subjectId,
                    scanWeight: scanWeight,
                    status: status,
                    scanAge: scanAgeDays,
                    collectionId: subjectScans[j].collectionId,
                    parentFolderId: subjectScans[j].parentFolderId,
                    folderId: subjectScans[j].folderId
                };
                tasks.push(scanTask);
                if (firstScanDays === null) {
                    firstScanDays = scanAgeDays;
                }
                firstScanDays = Math.min(firstScanDays, scanAgeDays);
                subject.firstScanDays = firstScanDays;
            }
        }
        // remove dob events
        var normalizedTasks = _.reject(tasks, _.matcher({ status: 'dob' }));
        // sort by first scan date
        subjectIds.sort(function (a, b) {
            var firstScanA = subjects[a].firstScanDays,
                firstScanB = subjects[b].firstScanDays;
            return (firstScanA < firstScanB) - (firstScanA > firstScanB);
        });
        var longitude = {
            subject_ids: subjectIds,
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

    _hierarchyUpdateCallback: function (folderId) {
        const folder = new FolderModel();
        folder
            .set({
                _id: folderId
            })
            .fetch()
            .done(() => {
                const collectionView = this.parentView;
                const hierarchyWidget = collectionView.hierarchyWidget;
                hierarchyWidget.breadcrumbs = [folder];
                hierarchyWidget._fetchToRoot(folder);
                hierarchyWidget.setCurrentModel(folder, { setRoute: false });
            })
            .fail(() => {
                console.error(`Error fetching folder ${folderId}`);
            });
    },

    render: function () {
        this.$el.html(CollectionInfopageTemplate());

        const infoPage = this.model.get('monkeybrainsInfoPage');
        if (infoPage) {
            const infopageMarkdownContainer = this.$('.g-collection-infopage-markdown');
            renderMarkdown(infoPage, infopageMarkdownContainer);
        }

        restRequest({
            url: `collection/${this.model.id}/datasetEvents`,
            method: 'GET'
        })
            .done((resp) => {
                const longitudeData = this.createLongitudeInput(resp);
                const settings = {
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
                const longitude = d3.longitude(
                    '.g-collection-infopage-longitude',
                    settings,
                    _.bind(this._hierarchyUpdateCallback, this)
                );
                // display longitude chart in scan age display to start
                longitude('linear');
            })
            .fail((err) => {
                console.error('Error getting datasetEvents', err);
            });

        return this;
    }
});

export default InfoPageWidget;
