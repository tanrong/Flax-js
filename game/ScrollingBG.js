/**
 * Created by long on 14-2-27.
 */

var lg = lg || {};

lg.ScrollingBG = cc.Node.extend({
    source:null,
    assetID:null,
    bg0:null,
    bg1:null,
    _isTiled:null,
    _scrolling:false,
    _paused:false,
    _speedX:0,
    _speedY:0,
    _d:1,
    _size:null,


    init:function()
    {
        if(this._super()){
            if(this.source == null){
                cc.log("Please give a source!");
                return false;
            }
            //If it's a custom display
            if(this.assetID != null){
                if(this._isTiled !== true){
                    this.bg0 = lg.assetsManager.createDisplay(this.source, this.assetID);
                    this.bg1 = lg.assetsManager.createDisplay(this.source, this.assetID);
                }else{
                    this.bg0 = lg.TiledImage.create(this.source, this.assetID);
                    this.bg1 = lg.TiledImage.create(this.source, this.assetID);
                }
            }else if(this.source){
                //If it's a image
                if(lg.isImageFile(this.source)){
                    this.bg0 = cc.Sprite.create(this.source);
                    this.bg1 = cc.Sprite.create(this.source);
                }else {
                    cc.log("Not support source type!");
                    return false;
                }
            }
            this.bg0.setAnchorPoint(0, 0);
            this.bg1.setAnchorPoint(0, 0);
            this.addChild(this.bg0);
            this.addChild(this.bg1);
            this._size = this.bg0.getContentSize();
            return true;
        }
        return false;
    },
    startXScroll:function(speed)
    {
        if(speed == 0) return;
        if(this._scrolling) return;
        this._scrolling = true;
        this._speedX = speed;
        this._speedY = 0;
        this._d = (this._speedX > 0) ? 1: -1;
        this._resetScroll();
        this._doScroll();
    },
    startYScroll:function(speed)
    {
        if(speed == 0) return;
        if(this._scrolling) return;
        this._scrolling = true;
        this._speedY = speed;
        this._speedX = 0;
        this._d = (this._speedY > 0) ? 1: -1;
        this._resetScroll();
        this._doScroll();
    },
    pauseScroll:function()
    {
        if(!this._scrolling) return;
        if(this._paused) return;
        this._paused = true;
        this.bg0.stopAllActions();
        this.bg1.stopAllActions();
        this.unscheduleAllCallbacks();
    },
    resumeScroll:function()
    {
        if(!this._scrolling) return;
        if(!this._paused) return;
        this._paused = false;
        if(this._speedX != 0){
            this._doScroll(this._size.width - Math.abs(this.bg0.x));
        }else if(this._speedY != 0) {
            this._doScroll(this._size.height - Math.abs(this.bg0.y));
        }
    },
    _resetScroll:function()
    {
        this.bg0.setPosition(0, 0);
        (this._speedX != 0) ? this.bg1.x = -this._d*(this._size.width - 1) : this.bg1.y = -this._d*(this._size.height - 1);
    },
    _doScroll:function(dist)
    {
        if(dist == 0) return;
        if(dist == null) dist = (this._speedX != 0) ? this._size.width : this._size.height;
        var t = dist/Math.abs(this._speedY);
        this.bg0.runAction(cc.MoveBy.create(t, cc.p(0, dist*this._d)));
        this.bg1.runAction(cc.MoveBy.create(t, cc.p(0, dist*this._d)));
        this.scheduleOnce(function(){
            if(this._scrolling && !this._paused){
                var temp = this.bg0;
                this.bg0 = this.bg1;
                this.bg1 = temp;
                this._resetScroll();
                this._doScroll();
            }
        },t);
    }
});

lg.ScrollingBG.create = function(source, assetID, isTiled)
{
    var bg = new lg.ScrollingBG();
    bg.source = source;
    bg.assetID = assetID;
    bg._isTiled = isTiled;
    if(bg.init()) return bg;
    return null;
};