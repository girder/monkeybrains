import d3 from 'd3';
import $ from 'jquery';
import _ from 'underscore';

import './stylesheets/longitude.styl';

/**
 * This longitudinal chart is based on the d3 gantt chart v2.0 originally
 * created by author Dimitry Kudrayvtsev.
 */
d3.longitude = function (selector, options, hierarchyUpdateCallback) {
    var FIT_TIME_DOMAIN_MODE = 'fit';
    var FIXED_TIME_DOMAIN_MODE = 'fixed'; // eslint-disable-line no-unused-vars
    var defaultTimeDomainStart = d3.time.day.offset(new Date(), -3);
    var defaultTimeDomainEnd = d3.time.hour.offset(new Date(), +3);
    var defaults = {
        mode: 'time',
        timeDomain: [defaultTimeDomainStart, defaultTimeDomainEnd],
        linearDomain: [0, 1],
        timeDomainMode: FIT_TIME_DOMAIN_MODE,
        tickFormat: '%m-%y',
        taskStatuses: [],
        // example
        // {"dob":"birth","scan-weight-1":"scan-weight-1","scan-weight-2":"scan-weight-2","scan-weight-3":"scan-weight-3","scan-weight-4":"scan-weight-4","scan-weight-5":"scan-weight-5","scan-weight-6":"scan-weight-6","scan-weight-7":"scan-weight-7","scan-weight-8":"scan-weight-8"}
        rowLabels: [], // subject ids
        weightBinRanges: [],
        // example
        // {"bin":"scan-weight-1","start":0.535,"end":1.151875},{"bin":"scan-weight-2","start":1.151875,"end":1.7687499999999998},{"bin":"scan-weight-3","start":1.7687499999999998,"end":2.3856249999999997},{"bin":"scan-weight-4","start":2.3856249999999997,"end":3.0024999999999995},{"bin":"scan-weight-5","start":3.0024999999999995,"end":3.6193749999999993},{"bin":"scan-weight-6","start":3.6193749999999993,"end":4.236249999999999},{"bin":"scan-weight-7","start":4.236249999999999,"end":4.8531249999999995},{"bin":"scan-weight-8","start":4.8531249999999995,"end":5.47}]
        tasks: [], //
        // example
        // {"sex":"F","folderId":"550702610640fd09bf7d6f54","collectionId":"550701fd0640fd09bf7d6f51","startDate":"2010-06-06T00:00:00.000Z","endDate":"2010-06-07T00:00:00.000Z","taskName":"001","status":"dob"}
        normalizedTasks: [],
        // example
        // {"sex":"F","startDate":"2011-06-01T00:00:00.000Z","endDate":"2011-06-02T00:00:00.000Z","taskName":"001","scanWeight":1.9,"status":"scan-weight-2","scanAge":360,"collectionId":"550701fd0640fd09bf7d6f51","parentFolderId":"550702610640fd09bf7d6f54","folderId":"550702610640fd09bf7d6f55"}
        subjectsFolders: {} // mapping of subject id to folderId of that subject's top level folder
    };

    var settings = options;
    _.defaults(settings, defaults);
    var _selector = selector;
    var element = $(selector);
    var margin = {
        top: 20,
        right: 40,
        bottom: 20,
        left: 150
    };
    var _tasks = [];
    var height = element.height() - margin.top - margin.bottom - 5;
    var width = element.width() - margin.right - margin.left - 5;
    var keyFunction;
    var getKeyFunction = function () {
        if (settings.mode === 'time') {
            return function (d) {
                return d.startDate + d.taskName + d.endDate;
            };
        } else {
            return function (d) {
                return d.taskName + d.scanAge;
            };
        }
    };

    var rectTransform;
    var getRectTransform = function () {
        if (settings.mode === 'time') {
            return function (d) {
                return 'translate(' + (x(d.startDate) - 8) + ',' + y(d.taskName) + ')';
            };
        } else {
            return function (d) {
                return 'translate(' + (x(d.scanAge) - 8) + ',' + y(d.taskName) + ')';
            };
        }
    };

    var x, y, xAxis, yAxis;

    var initTimeDomain = function () {
        if (settings.timeDomainMode === FIT_TIME_DOMAIN_MODE) {
            if (typeof _tasks === 'undefined' || _tasks.length < 1) {
                settings.timeDomain = [d3.time.day.offset(new Date(), -3), d3.time.hour.offset(new Date(), +3)];
                return;
            }
            _tasks.sort(function (a, b) {
                return a.endDate - b.endDate;
            });
            settings.timeDomain[1] = _tasks[_tasks.length - 1].endDate;
            _tasks.sort(function (a, b) {
                return a.startDate - b.startDate;
            });
            settings.timeDomain[0] = _tasks[0].startDate;
        }
    };

    var initAxis = function () {
        if (settings.mode === 'time') {
            x = d3.time.scale().domain(settings.timeDomain).range([0, width]).clamp(true);
            xAxis = d3.svg.axis().scale(x).orient('bottom').tickFormat(d3.time.format(settings.tickFormat)).tickSubdivide(true)
                .tickSize(8).tickPadding(8);
        } else {
            x = d3.scale.linear().domain(settings.linearDomain).range([0, width]);
            xAxis = d3.svg.axis().scale(x).orient('bottom').tickSubdivide(true).tickSize(8).tickPadding(8);
        }
        y = d3.scale.ordinal().domain(settings.rowLabels).rangeRoundBands([0, height - margin.top - margin.bottom], 0.1);
        yAxis = d3.svg.axis().scale(y).orient('left').tickSize(0);
    };

    var longitude = function (mode) {
        $('.g-collection-infopage-longitude').empty();
        var tooltip = d3.select('.g-collection-infopage-longitude')
            .append('div')
            .attr('class', 'infopage-longitude-tooltip');
        tooltip.append('div')
            .attr('class', 'longitude-tooltip-event');
        tooltip.append('div')
            .attr('class', 'longitude-tooltip-date');

        var tooltipData = tooltip.append('div')
            .attr('class', 'longitude-tooltip-data');

        var tooltipSubject = tooltipData.append('div')
            .attr('class', 'longitude-tooltip-subject longitude-tooltip-data-row');
        tooltipSubject.append('span')
            .attr('class', 'longitude-tooltip-subject-key longitude-tooltip-key');
        tooltipSubject.select('.longitude-tooltip-subject-key').text('Subject');
        tooltipSubject.append('span')
            .attr('class', 'longitude-tooltip-subject-value longitude-tooltip-value');

        var tooltipScanWeight = tooltipData.append('div')
            .attr('class', 'longitude-tooltip-scan-weight longitude-tooltip-data-row longitude-tooltip-scan');
        tooltipScanWeight.append('span')
            .attr('class', 'longitude-tooltip-scan-weight-key longitude-tooltip-key');
        tooltipScanWeight.select('.longitude-tooltip-scan-weight-key').text('Weight (kg)');
        tooltipScanWeight.append('span')
            .attr('class', 'longitude-tooltip-scan-weight-value longitude-tooltip-value');

        var tooltipScanAge = tooltipData.append('div')
            .attr('class', 'longitude-tooltip-scan-age longitude-tooltip-data-row longitude-tooltip-scan');
        tooltipScanAge.append('span')
            .attr('class', 'longitude-tooltip-scan-age-key longitude-tooltip-key');
        tooltipScanAge.select('.longitude-tooltip-scan-age-key').text('Age (days)');
        tooltipScanAge.append('span')
            .attr('class', 'longitude-tooltip-scan-age-value longitude-tooltip-value');

        var svg = d3.select(_selector)
            .append('svg')
            .attr('class', 'chart')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('class', 'longitude-chart')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

        var legendRectSize = 14;
        var legendSpacing = 3;
        var legendGroup = svg.append('g')
            .attr('class', 'legendGroup')
            .attr('transform', 'translate(-100,0)');

        var legend = legendGroup.selectAll('.legend')
            .data(settings.weightBinRanges)
            .enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', function (d, i) {
                var height = legendRectSize + legendSpacing;
                var horz = -2 * legendRectSize;
                var vert = i * height;
                return 'translate(' + horz + ',' + vert + ')';
            });
        legend.append('rect')
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .attr('class', function (d) { return d.bin; });

        legend.append('text')
            .attr('x', legendRectSize + legendSpacing)
            .attr('y', legendRectSize - legendSpacing)
            .text(function (d) { return d.start.toFixed(2) + '-' + d.end.toFixed(2) + ' kg'; });

        legendGroup.append('text')
            .attr('x', -35)
            .attr('y', ((legendRectSize + legendSpacing) * settings.weightBinRanges.length) + (legendRectSize))
            .attr('font-size', '14px')
            .text('weight at scan');

        legendGroup.append('rect')
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .attr('x', -28)
            .attr('y', ((legendRectSize + legendSpacing + 1) * settings.weightBinRanges.length) + (legendRectSize))
            .attr('class', 'birth');

        legendGroup.append('text')
            .attr('x', -28 + legendRectSize + legendSpacing)
            .attr('y', ((legendRectSize + (legendSpacing * 2)) * settings.weightBinRanges.length) + (3 * legendRectSize / 4))
            .attr('font-size', '14px')
            .text('birth event');

        legendGroup.append('circle')
            .attr('cx', -21)
            .attr('cy', ((legendRectSize + (legendSpacing * 2)) * settings.weightBinRanges.length) + (1.5 * legendRectSize))
            .attr('r', 5);

        legendGroup.append('text')
            .attr('x', -28 + legendRectSize + legendSpacing)
            .attr('y', ((legendRectSize + (legendSpacing * 2)) * settings.weightBinRanges.length) + (1.75 * legendRectSize))
            .attr('font-size', '14px')
            .text('male');

        legendGroup.append('path')
            .attr('d', 'M-1 6L 11 6 M5 0 L5 12') // forms a plus sign
            .attr('transform', 'translate(-26, 190)')
            .style('stroke-width', '4')
            .style('stroke', 'black');

        legendGroup.append('text')
            .attr('x', -28 + legendRectSize + legendSpacing)
            .attr('y', ((legendRectSize + (legendSpacing * 2)) * settings.weightBinRanges.length) + (2.75 * legendRectSize))
            .attr('font-size', '14px')
            .text('female');

        return longitude.redraw(settings.mode);
    };

    longitude.settings = function (newSettings) {
        _.defaults(settings, newSettings);
    };

    longitude.redraw = function (mode) {
        settings.mode = mode;
        if (settings.mode === 'time') {
            _tasks = settings.tasks;
        } else {
            _tasks = settings.normalizedTasks;
        }
        initTimeDomain();
        initAxis();
        rectTransform = getRectTransform();
        keyFunction = getKeyFunction();

        var svg = d3.select('svg');

        var longitudeChartGroup = svg.select('.longitude-chart'); // eslint-disable-line no-unused-vars

        var xAxisLabel;
        var xAxisSwitchLabel;
        if (settings.mode === 'time') {
            xAxisLabel = 'Event Date';
            xAxisSwitchLabel = '[click to normalize by time since birth]';
        } else {
            xAxisLabel = 'Scan Time (days since subject\'s birth)';
            xAxisSwitchLabel = '[click to display calendar view]';
        }

        svg.select('.longitude-chart').select('.xaxis').remove();
        svg.select('.longitude-chart').append('g')
            .attr('class', 'x axis xaxis')
            .attr('transform', 'translate(0, ' + (height - margin.top - margin.bottom) + ')')
            .call(xAxis)
            .append('text')
            .attr('font-size', '16px')
            .attr('y', 40)
            .attr('x', 360)
            .attr('dy', '.71em')
            .text(xAxisLabel);
        svg.select('.xaxis').append('text')
            .attr('font-size', '12px')
            .attr('y', 40)
            .attr('x', 660)
            .attr('dy', '.71em')
            .text(xAxisSwitchLabel)
            .on('click', function () {
                if (settings.mode === 'time') {
                    longitude.redraw('linear');
                } else {
                    longitude.redraw('time');
                }
            });

        svg.select('.longitude-chart').select('.yaxis').remove();
        svg.select('.longitude-chart').append('g')
            .attr('class', 'y axis yaxis')
            .call(yAxis)
            .append('text')
            .attr('font-size', '16px')
            .attr('transform', 'rotate(-90)')
            .attr('y', -50)
            .attr('x', -225)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')
            .text('Subject ID');
        d3.select('.yaxis')
            .selectAll('.tick')
            .on('mouseover', function (d) {
                d3.select('body').style('cursor', 'pointer');
            })
            .on('mouseout', function (d) {
                d3.select('body').style('cursor', 'auto');
            })
            .on('click', function (d) {
                hierarchyUpdateCallback(settings.subjectsFolders[d]);
            });

        var tooltipOffsetX = 10;
        var tooltipOffsetY = 10;
        var eventMouseover = function (d) {
            d3.select('body').style('cursor', 'pointer');
            var tooltip = d3.select('.infopage-longitude-tooltip');
            var date = new Date(d.startDate);
            tooltip.select('.longitude-tooltip-date').text(date.toDateString());
            tooltip.select('.longitude-tooltip-subject-value').text(d.taskName);

            if (d.status === 'dob') {
                tooltip.select('.longitude-tooltip-event').text('Birth Event');
                $('.longitude-tooltip-scan').hide();
            } else {
                tooltip.select('.longitude-tooltip-event').text('Scan Event');
                $('.longitude-tooltip-scan').show();
                tooltip.select('.longitude-tooltip-scan-weight-value').text(d.scanWeight);
                tooltip.select('.longitude-tooltip-scan-age-value').text(d.scanAge);
            }
            // show the tooltip offset from the event rect
            var tooltipWidth = $('.infopage-longitude-tooltip').outerWidth();
            var tooltipLeft;
            if (d3.event.offsetX + tooltipOffsetX + tooltipWidth > $('.g-collection-infopage-longitude').width()) {
                tooltipLeft = d3.event.offsetX - (tooltipOffsetX + tooltipWidth);
            } else {
                tooltipLeft = d3.event.offsetX + tooltipOffsetX;
            }
            tooltip.style('top', (d3.event.offsetY + tooltipOffsetY) + 'px')
                .style('left', tooltipLeft + 'px');
            $('.infopage-longitude-tooltip').show();
        };

        var eventMouseout = function (d) {
            $('.infopage-longitude-tooltip').hide();
            d3.select('body').style('cursor', 'auto');
        };

        var eventClick = function (d) {
            hierarchyUpdateCallback(d.folderId);
        };

        var sexSortedEvents = _.groupBy(_tasks, _.property('sex'));

        svg.selectAll('.female-event').remove();
        // eslint-disable-next-line no-unused-vars
        var femaleEvents = svg.select('.longitude-chart').selectAll('.female-event')
            .data(sexSortedEvents.F, keyFunction).enter()
            .append('path')
            .attr('d', 'M-1 6L 11 6 M5 0 L5 12') // forms a plus sign
            .attr('transform', rectTransform)
            .attr('class', function (d) {
                return 'female-event ' + settings.taskStatuses[d.status];
            })
            .on('click', eventClick)
            .on('mouseout', eventMouseout)
            .on('mouseover', eventMouseover);

        svg.selectAll('.male-event').remove();
        // eslint-disable-next-line no-unused-vars
        var maleEvents = svg.select('.longitude-chart').selectAll('.male-event')
            .data(sexSortedEvents.M, keyFunction).enter()
            .append('circle')
            .attr('cx', 5)
            .attr('cy', 5)
            .attr('r', 5)
            .attr('class', function (d) {
                return 'male-event ' + settings.taskStatuses[d.status];
            })
            .on('click', eventClick)
            .on('mouseout', eventMouseout)
            .on('mouseover', eventMouseover)
            .attr('transform', rectTransform);

        return longitude;
    };

    return longitude;
};
