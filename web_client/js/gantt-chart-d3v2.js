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
        'timeDomainMode': FIT_TIME_DOMAIN_MODE,
        'tickFormat': '%m-%y',
        'taskStatuses': [],
        'rowLabels': []
    };

    var settings = options;
    _.defaults(settings, defaults);

    //console.log('settings');
    //console.log(settings);

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


    var keyFunction = function(d) {
        return d.startDate + d.taskName + d.endDate;
    };

    var rectTransform = function(d) {
	    return "translate(" + x(d.startDate) + "," + y(d.taskName) + ")";
    };

    var x = d3.time.scale().domain(settings.timeDomain).range([ 0, width ]).clamp(true);
    var y = d3.scale.ordinal().domain(settings.rowLabels).rangeRoundBands([ 0, height - margin.top - margin.bottom ], .1);

    var xAxis = d3.svg.axis().scale(x).orient("bottom").tickFormat(d3.time.format(settings.tickFormat)).tickSubdivide(true)
	    .tickSize(8).tickPadding(8);

    var yAxis = d3.svg.axis().scale(y).orient("left").tickSize(0);

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
            settingstimeDomain[0] = _tasks[0].startDate;
        }
    };

    var initAxis = function() {
        if (settings.mode === 'time') {
            x = d3.time.scale().domain(settings.timeDomain).range([ 0, width ]).clamp(true);
            xAxis = d3.svg.axis().scale(x).orient("bottom").tickFormat(d3.time.format(settings.tickFormat)).tickSubdivide(true)
                .tickSize(8).tickPadding(8);
        } else {
//            console.log("initAxis linear");
//            console.log(timeDomainEnd);
//            xNorm = d3.scale.linear().domain([0, timeDomainEnd]).range([0, width]);
//            xAxis = d3.svg.axis().scale(x).orient("bottom").tickSubdivide(true).tickSize(8).tickPadding(8);
        }
        y = d3.scale.ordinal().domain(settings.rowLabels).rangeRoundBands([ 0, height - margin.top - margin.bottom ], .1);
        yAxis = d3.svg.axis().scale(y).orient("left").tickSize(0);
    };

    function gantt(tasks) {
        _tasks = tasks;
        initTimeDomain();
        initAxis();

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

          svg.selectAll(".chart")
         .data(tasks, keyFunction).enter()
         .append("rect")
         .attr("rx", 5)
             .attr("ry", 5)
         .attr("class", function(d){
             if(settings.taskStatuses[d.status] == null){ return "bar";}
             return settings.taskStatuses[d.status];
             })
         .attr("y", 0)
         .attr("transform", rectTransform)
         .attr("height", function(d) { return y.rangeBand()-1; })
         .attr("width", function(d) {
             var taskWidth = (x(d.endDate) - x(d.startDate));
             return Math.max(taskWidth, 1);
         });


         svg.append("g")
         .attr("class", "x axis")
         .attr("transform", "translate(0, " + (height - margin.top - margin.bottom) + ")")
         .transition()
         .call(xAxis);

         svg.append("g").attr("class", "y axis").transition().call(yAxis);

         return gantt;

    };

    gantt.settings = function(newSettings) {
        _.defaults(settings, newSettings);
    };

    gantt.redraw = function(tasks) {

        initTimeDomain();
        initAxis();

        var svg = d3.select("svg");

        var ganttChartGroup = svg.select(".gantt-chart");
        var rect = ganttChartGroup.selectAll("rect").data(tasks, keyFunction);

        rect.enter()
            .insert("rect",":first-child")
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("class", function(d){
            if(settings.taskStatuses[d.status] == null){ return "bar";}
                return settings.taskStatuses[d.status];
            })
            .transition()
            .attr("y", 0)
            .attr("transform", rectTransform)
            .attr("height", function(d) { return y.rangeBand(); })
            .attr("width", function(d) { return (x(d.endDate) - x(d.startDate)); });

        rect.transition()
            .attr("transform", rectTransform)
            .attr("height", function(d) { return y.rangeBand(); })
            .attr("width", function(d) {
            return (x(d.endDate) - x(d.startDate));
	    });

        rect.exit().remove();

        svg.select(".x").transition().call(xAxis);
        svg.select(".y").transition().call(yAxis);

        return gantt;
    };

    return gantt;
};
