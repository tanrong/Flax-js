/**
 * Created by long on 14-2-22.
 */
var lg = lg || {};

lg.GunParam = cc.Class.extend({
    bulletPlist:null,//the plist of the bullet
    bulletID:null,//the id of the bullet asset
    collideSize:20,//the bullet collide radius
    targetMap:null,//the TileMap name of the target to shoot
    damage:1,//the damage of the bullet
    speed:600,//the move speed of the bullet per second
    interval:0.15,//the interval time between two launch
    count:1,//the bullet count in one launch
    angleGap:5,//if count > 1, angle gap between two bullets at one launch
    waveInterval:0.3,//the seconds interval between two wave launch, if <= 0 then no wave mode
    countInWave:6,//launch times in one wave
    fireSound:null,//the sound when fire
    fireEffectID:null,//the id of fire effect, it must be packed with the bullet plist together
    hitEffectID:null,//the id of hit effect, it must be packed with the bullet plist together
    isMissle:false//todo, if it's missile
});

lg.GunParam.create = function(param)
{
    var gp = new lg.GunParam();
    lg.copyProperties(param, gp);
    return gp;
}

lg.Gun = cc.Node.extend({
    owner:null,
    param:null,
    _firing:false,
    _pool:null,
    _waveTime:0,
    _maxShootDistance:0,
    _bullets:null,
    _targetMap:null,

    init:function()
    {
        this._super();
        this._bullets = [];
    },
    start:function()
    {
        if(this._firing) return;
        this._firing = true;

        this._pool = lg.ObjectPool.get(this.param.bulletPlist, "lg.Animator");
        this._waveTime = this.param.interval*this.param.countInWave + this.param.waveInterval;
        this._maxShootDistance = Math.max(cc.visibleRect.width, cc.visibleRect.height)*1.5;

        if(this.param.waveInterval <= 0 || this.param.countInWave <= 1) {
            this.schedule(this._createBullet, this.param.interval);
        }else{
            this._waveFire();
        }
        this.scheduleUpdate();
        this.schedule(this.update, 0.1, cc.REPEAT_FOREVER);
    },
    end:function()
    {
        if(!this._firing) return;
        this._firing = false;
        this.unschedule(this._createBullet);
        this.unschedule(this._createWave);
        this.unschedule(this.update);
    },
    update:function(delta)
    {
        var i = this._bullets.length;
        if(i == 0) return;
        var b = null;
        var targets = null;
        var target = null;
        var j = -1;
        var rect = null;
        var over = false;
        var pos = null;
        var rot = null;
        var collide = null;
        //Note: how to delete item of an Array in a loop, this is a template!
        while(i--) {
            b = this._bullets[i];
            rect = b.collider;
            over = false;
            if(!cc.rectIntersectsRect(cc.rect(0, 0, cc.visibleRect.width, cc.visibleRect.height), rect)){
                over = true;
            }else if(this.param.targetMap){
                if(this._targetMap == null) this._targetMap = lg.getTileMap(this.param.targetMap);
                if(this._targetMap) targets = this._targetMap.getCoveredTiles1(rect, true);
                //todo, some other handle method, for example: set the targets mannually
                else continue;

                j = -1;
                pos = lg.getPosition(b, true);
                rot = lg.getRotation(b, true);
                while(++j < targets.length) {
                    target = targets[j];
                    if(target == this.owner) continue;
                    if(target.dead === true) continue;
                    if(this.owner && target.camp == this.owner.camp) continue;
                    //hit the target
//                    collide = cc.rectIntersection(target.collider, rect);
//                    if(this.collideSize == -1) this.collideSize = (rect.width*rect.height)/2;
//                    if(collide.width*collide.height > this.collideSize){
                    collide = cc.rectIntersection(target.collider, rect);
//                    if(this.collideSize == -1) this.collideSize = 2*(rect.width + rect.height)/(2*Math.PI);
                    if(cc.pDistance(pos, target.collidCenter) < this.param.collideSize){
                        if(target.onHit) {
                            target.dead = target.onHit(b);
                        }
                        this._showHitEffect(pos, rot);
                        over = true;
                        break;
                    }
                }
            }
            if(over) {
                b.destroy();
                this._bullets.splice(i, 1);
            }
        }
    },
    updateParam:function(param)
    {
        if(param == null) return;
        lg.copyProperties(param, this.param);
        this.end();
        this.start();
    },
    isFiring:function()
    {
        return this._firing;
    },
    _waveFire:function()
    {
        if(!this._firing) return;
        this._createWave();
        this.schedule(this._createWave, this._waveTime, cc.REPEAT_FOREVER);
    },
    _createBullet:function()
    {
        if(lg.Gun.batchCanvas == null) {
            cc.log("Pls set batch canvas for me to show the bullet: lg.Gun.batchCanvas!");
            return;
        }
        var t = this._maxShootDistance/this.param.speed;
        var pos = this.parent.convertToWorldSpace(this.getPosition());
        var rot = lg.getRotation(this, true);
        var b = null;
        var i = -1;
        var r = 0;
        var d = 0;
        var ints  = lg.createDInts(this.param.count);
        while(++i < this.param.count)
        {
            d = ints[i];
            r = rot + d*this.param.angleGap;
            b = this._pool.fetch(this.param.bulletID, lg.Gun.batchCanvas);
            b.damage = this.param.damage;
            b.play();
            b.setPosition(pos);
            b.setRotation(rot);
            b.runAction(cc.MoveBy.create(t,lg.getPointOnCircle(this._maxShootDistance, r)));
            this._bullets.push(b);
        }
        this._showFireEffect(pos, rot);
        if(this.param.fireSound) lg.playSound(this.param.fireSound);
    },
    _createWave:function()
    {
        this.schedule(this._createBullet, this.param.interval, this.param.countInWave - 1);
    },
    _showFireEffect:function(pos, rot)
    {
        if(this.param.fireEffectID == null || this.param.fireEffectID == "") return;
        var fireEffect = lg.assetsManager.createDisplay(this.param.bulletPlist, this.param.fireEffectID, null, true, lg.Gun.batchCanvas);
        fireEffect.zIndex = 999;
        fireEffect.autoDestroyWhenOver = true;
        fireEffect.setPosition(pos);
        fireEffect.setRotation(rot);
        fireEffect.gotoAndPlay(0);
    },
    _showHitEffect:function(pos, rot)
    {
        if(this.param.hitEffectID == null || this.param.hitEffectID == "") return;
        var hitEffect = lg.assetsManager.createDisplay(this.param.bulletPlist, this.param.hitEffectID, null, true, lg.Gun.batchCanvas);
        hitEffect.zIndex = 999;
        hitEffect.autoDestroyWhenOver = true;
        hitEffect.setPosition(pos);
        hitEffect.setRotation(rot);
        hitEffect.gotoAndPlay(0);
    }
});

lg.Gun.batchCanvas = null;

lg.Gun.create = function(param)
{
    if(param == null) {
        cc.log("Please give me a param defiled like: lg.GunParam!");
        return null;
    }
    param = lg.GunParam.create(param);
    var gun = new lg.Gun();
    gun.param = param;
    gun.init();
    return gun;
};