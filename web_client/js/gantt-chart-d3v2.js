/**
 * @author Dimitry Kudrayvtsev
 * @version 2.0
 */
d3.gantt = function(selector, options) {
    var FIT_TIME_DOMAIN_MODE = "fit";
    var FIXED_TIME_DOMAIN_MODE = "fixed";
    var defaultTimeDomainStart = d3.time.day.offset(new Date(),-3);
    var defaultTimeDomainEnd = d3.time.hour.offset(new Date(),+3);
    var defaults = {
        'mode': 'time',
        'timeDomain': [defaultTimeDomainStart, defaultTimeDomainEnd],
        'linearDomain': [0,1],
        'timeDomainMode': FIT_TIME_DOMAIN_MODE,
        'tickFormat': '%m-%y',
        'taskStatuses': [],
        'rowLabels': [],
        'weightBinRanges': [],
        'tasks': [],
        'normalizedTasks': []
    };

    var settings = options;
    _.defaults(settings, defaults);
    var _selector = selector;
    var element = $(selector);
    var margin = {
        top : 20,
        right : 40,
        bottom : 20,
        left : 150
    };
    var _tasks = [];
    var height = element.height() - margin.top - margin.bottom-5;
    var width = element.width() - margin.right - margin.left-5;


    var keyFunction;
    function getKeyFunction() {
        if (settings.mode === 'time') {
            return  function(d) {
                return d.startDate + d.taskName + d.endDate;
            };
        } else {
            return  function(d) {
                return d.taskName + d.scanAge;
            };
        }
    };

    var rectTransform;
    function getRectTransform() {
        if (settings.mode === 'time') {
            return  function(d) {
	            return "translate(" + x(d.startDate) + "," + y(d.taskName) + ")";
            };
        } else {
            return  function(d) {
                return "translate(" + x(d.scanAge) + "," + y(d.taskName) + ")";
            };
        }
    };

    var x, y;

    var initTimeDomain = function() {
        if (settings.timeDomainMode === FIT_TIME_DOMAIN_MODE) {
            if (typeof _tasks === 'undefined' || _tasks.length < 1) {
                settings.timeDomain = [d3.time.day.offset(new Date(), -3),
                                       d3.time.hour.offset(new Date(), +3)];
                return;
            }
            _tasks.sort(function(a, b) {
                return a.endDate - b.endDate;
            });
            settings.timeDomain[1] = _tasks[_tasks.length - 1].endDate;
            _tasks.sort(function(a, b) {
                return a.startDate - b.startDate;
            });
            settings.timeDomain[0] = _tasks[0].startDate;
        }
    };

    var initAxis = function() {
        if (settings.mode === 'time') {
            x = d3.time.scale().domain(settings.timeDomain).range([ 0, width ]).clamp(true);
            xAxis = d3.svg.axis().scale(x).orient("bottom").tickFormat(d3.time.format(settings.tickFormat)).tickSubdivide(true)
                .tickSize(8).tickPadding(8);
        } else {
            x = d3.scale.linear().domain(settings.linearDomain).range([0, width]);
            xAxis = d3.svg.axis().scale(x).orient("bottom").tickSubdivide(true).tickSize(8).tickPadding(8);
        }
        y = d3.scale.ordinal().domain(settings.rowLabels).rangeRoundBands([ 0, height - margin.top - margin.bottom ], .1);
        yAxis = d3.svg.axis().scale(y).orient("left").tickSize(0);
    };

    function gantt(mode) {
        $('.g-collection-infopage-gantt').empty();
        var tooltip = d3.select('.g-collection-infopage-gantt')
            .append('div')
            .attr('class', 'infopage-gantt-tooltip');
        tooltip.append('div')
            .attr('class', 'gantt-tooltip-event');
        tooltip.append('div')
            .attr('class', 'gantt-tooltip-date');

        var tooltipData = tooltip.append('div')
            .attr('class', 'gantt-tooltip-data');

        var tooltipSubject = tooltipData.append('div')
            .attr('class', 'gantt-tooltip-subject gantt-tooltip-data-row');
        tooltipSubject.append('span')
            .attr('class', 'gantt-tooltip-subject-key gantt-tooltip-key');
        tooltipSubject.select('.gantt-tooltip-subject-key').text('Subject');
        tooltipSubject.append('span')
            .attr('class', 'gantt-tooltip-subject-value gantt-tooltip-value');

        var tooltipScanWeight = tooltipData.append('div')
            .attr('class', 'gantt-tooltip-scan-weight gantt-tooltip-data-row gantt-tooltip-scan');
        tooltipScanWeight.append('span')
            .attr('class', 'gantt-tooltip-scan-weight-key gantt-tooltip-key');
        tooltipScanWeight.select('.gantt-tooltip-scan-weight-key').text('Weight (kg)');
        tooltipScanWeight.append('span')
            .attr('class', 'gantt-tooltip-scan-weight-value gantt-tooltip-value');

        var tooltipScanAge = tooltipData.append('div')
            .attr('class', 'gantt-tooltip-scan-age gantt-tooltip-data-row gantt-tooltip-scan');
        tooltipScanAge.append('span')
            .attr('class', 'gantt-tooltip-scan-age-key gantt-tooltip-key');
        tooltipScanAge.select('.gantt-tooltip-scan-age-key').text('Age (days)');
        tooltipScanAge.append('span')
            .attr('class', 'gantt-tooltip-scan-age-value gantt-tooltip-value');

       var svg = d3.select(_selector)
            .append("svg")
            .attr("class", "chart")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("class", "gantt-chart")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

        var legendRectSize = 18;
        var legendSpacing = 4;
        var legendGroup = svg.append('g')
            .attr('class', 'legendGroup')
            .attr('transform','translate(-100,0)');

        var legend = legendGroup.selectAll('.legend')
                .data(settings.weightBinRanges)
                .enter()
                .append('g')
                .attr('class', 'legend')
                .attr('transform', function(d, i) {
                    var height = legendRectSize + legendSpacing;
                    var horz = -2 * legendRectSize;
                    var vert = i * height;
                    return 'translate(' + horz + ',' + vert + ')';
                });
        legend.append('rect')
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .attr("class", function(d){ return d.bin; });

        legend.append('text')
            .attr('x', legendRectSize + legendSpacing)
            .attr('y', legendRectSize - legendSpacing)
            .text(function(d) { return d.start.toFixed(2) + '-' + d.end.toFixed(2) + ' kg'; });

        legendGroup.append('text')
            .attr('x', -35)
            .attr('y', ((legendRectSize+legendSpacing) * settings.weightBinRanges.length) + (legendRectSize))
            .attr('font-size', '14px')
            .text('weight at scan');

        return gantt.redraw(settings.mode);
    };

    gantt.settings = function(newSettings) {
        _.defaults(settings, newSettings);
    };

    gantt.redraw = function(mode) {
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

        var svg = d3.select("svg");

        var ganttChartGroup = svg.select(".gantt-chart");

        var xAxisLabel;
        var xAxisSwitchLabel;
        if (settings.mode === 'time') {
            xAxisLabel = "Event Date";
            xAxisSwitchLabel = '[click to normalize by time since birth]';
        } else {
            xAxisLabel = "Scan Time (days since subject's birth)";
            xAxisSwitchLabel = '[click to display calendar view]';
        }

        svg.select('.gantt-chart').select('.xaxis').remove();
        svg.select('.gantt-chart').append("g")
            .attr("class", "x axis xaxis")
            .attr("transform", "translate(0, " + (height - margin.top - margin.bottom) + ")")
            .call(xAxis)
         .append("text")
            .attr("font-size", "16px")
            .attr("y", 40)
            .attr("x", 360)
            .attr("dy", ".71em")
            .text(xAxisLabel);
        svg.select('.xaxis').append("text")
            .attr("font-size", "12px")
            .attr("y", 40)
            .attr("x", 660)
            .attr("dy", ".71em")
            .text(xAxisSwitchLabel)
            .on('click', function() {
                if (settings.mode === 'time') {
                    gantt.redraw('linear');
                } else {
                    gantt.redraw('time');
                }
            });


        svg.select('.gantt-chart').select('.yaxis').remove();
        svg.select('.gantt-chart').append("g")
            .attr("class", "y axis yaxis")
            .call(yAxis)
        .append("text")
            .attr("font-size", "16px")
            .attr("transform", "rotate(-90)")
            .attr("y", -50)
            .attr("x", -225)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Subject ID");

        svg.selectAll('.gantt-event').remove();
        var tooltipOffsetX = 10;
        var tooltipOffsetY = 10;
        var events = svg.select('.gantt-chart').selectAll(".gantt-event")
            .data(_tasks, keyFunction).enter()
            .append("rect")
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("class", function(d){
                if(settings.taskStatuses[d.status] == null){ return "bar";}
                return "gantt-event "+ settings.taskStatuses[d.status];
            })
            .attr("y", 0)
            .attr("transform", rectTransform)
            .attr("height", function(d) { return y.rangeBand()-1; })
            .attr("width", function(d) {
                return 1;
            });
        events.on('mouseover', function(d) {
            var tooltip = d3.select('.infopage-gantt-tooltip');
            date = new Date(d.startDate);
            tooltip.select('.gantt-tooltip-date').text(date.toDateString());
            tooltip.select('.gantt-tooltip-subject-value').text(d.taskName);

            if (d.status === 'dob') {
                tooltip.select('.gantt-tooltip-event').text('Birth Event');
                $('.gantt-tooltip-scan').hide();
            } else {
                tooltip.select('.gantt-tooltip-event').text('Scan Event');
                $('.gantt-tooltip-scan').show();
                tooltip.select('.gantt-tooltip-scan-weight-value').text(d.scanWeight);
                tooltip.select('.gantt-tooltip-scan-age-value').text(d.scanAge);
            }
            // show the tooltip offset from the event rect
            var tooltipWidth = $('.infopage-gantt-tooltip').outerWidth();
            var tooltipLeft;
            if (d3.event.offsetX + tooltipOffsetX + tooltipWidth > $('.g-collection-infopage-gantt').width()) {
                tooltipLeft = d3.event.offsetX - (tooltipOffsetX + tooltipWidth);
            } else {
                tooltipLeft = d3.event.offsetX + tooltipOffsetX;
            }
            tooltip.style('top', (d3.event.offsetY + tooltipOffsetY) + 'px')
                .style('left', tooltipLeft + 'px');
            $('.infopage-gantt-tooltip').show();

        });
        events.on('click', function(d) {
            girder.router.navigate('collection/'+d.collectionId+'/folder/'+d.folderId, {trigger: true});
        });
        events.on('mouseout', function() {
            $('.infopage-gantt-tooltip').hide();
        });

        return gantt;
    };

    return gantt;
};
