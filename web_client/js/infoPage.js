var monkeybrainsPlugin = {
    views: {}
};

monkeybrainsPlugin.views.infoPageWidget = girder.View.extend({
    initialize: function (settings) {
        console.log("infoPageWidget initialize");
        this.model = settings.model;
        this.access = settings.access;
        console.log(settings);
        this.model.on('change', function () {
            this.render();
        }, this);
        this.render();
    },

    render: function() {
        console.log("infoPageWidget render");
        console.log(this.access);
        var id = this.model.get('_id');
        console.log(this.model.get('name'));
        console.log(girder);
        girder.restRequest({
            path: 'collection/' + id + '/infoPage',
            type: 'GET',
            error: null
        }).done(_.bind(function (resp) {
            var infoPage = resp.infoPage;
            console.log(infoPage);
            if (infoPage && infoPage !== '') {
                console.log('render template now');
                console.log($('.g-collection-header'));
                $('.g-collection-header').append(girder.templates.collection_infopage());
                var infoPageContainer = $('.g-collection-infopage-container');
                girder.renderMarkdown(infoPage, infoPageContainer);
            }
        }, this)).error(_.bind(function (err) {
            console.log("error getting infopage");
            console.log(err);
        }, this));
    }
});

girder.wrap(girder.views.CollectionView, 'render', function(render) {
    console.log('infoPageWidget wrapped pre-render');
    render.call(this);
    console.log('infoPageWidget wrapped post-render');
    this.infoPageWidget = new monkeybrainsPlugin.views.infoPageWidget({
        model: this.model,
        access: this.access,
        parentView: this
    });
    return this;
});
