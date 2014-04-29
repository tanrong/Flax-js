/**
 * Created by long on 14-1-31.
 */

var lg = lg || {};

F2C_ALIAS = {mc:"lg.MovieClip",
             button:"lg.Button",
             progress:"lg.ProgressBar"
            };

lg.AssetsManager = cc.Class.extend({
    framesCache:null,
    displaysCache:null,
    displayDefineCache:null,
    mcsCache:null,
    subAnimsCache:null,
    fontsCache:null,

   init:function()
   {
       this.framesCache = new buckets.Dictionary();
       this.displaysCache = new buckets.Dictionary();
       this.displayDefineCache = new buckets.Dictionary();
       this.mcsCache = new buckets.Dictionary();
       this.subAnimsCache = new buckets.Dictionary();
       this.fontsCache = new buckets.Dictionary();
   },
    /**
     * Create a display from a plistFile with assetID
     * @param {String} plistFile the plistFile
     * @param {String} assetID the asset id in the plistFile
     * @param {String} clsName the class name to create the display, if null, it'll be automatically set according by the plist
     * @param {Boolean} fromPool if the display should fetch from the pool
     * @param {Node} parent its parent container
     * @param {Object} params params could be set to the target with attr function
     * */
   createDisplay:function(plistFile, assetID, clsName, fromPool, parent, params)
   {
       if(plistFile == null || assetID == null){
           throw  "Pleas give me plistFile and assetID!";
       }
       this.addPlist(plistFile);

       var clsPreDefined = false;
       if(clsName) clsPreDefined = true;
       else clsName = assetID;

        var mcCls = lg.nameToObject(clsName);
        if(mcCls == null && !clsPreDefined) {
            var isMC = false;
            var define = this.getDisplayDefine(plistFile, assetID);
            if(define == null) {
                define = this.getMc(plistFile, assetID);
                isMC = true;
            }
            if(define){
                clsName = define.type;
                mcCls = lg.nameToObject(clsName);
                if(mcCls == null){
                    clsName = F2C_ALIAS[clsName];
                    mcCls = lg.nameToObject(clsName);
                }
                if(mcCls == null)
                {
                    mcCls = isMC ? lg.MovieClip : lg.Animator;
                    clsName = isMC ? "lg.MovieClip" : "lg.Animator";
                }
            }else if(isMC) {
                var subAnims = this.getSubAnims(plistFile, assetID);
                if(subAnims.length) {
                    assetID = assetID + "$" + subAnims[0];
                    mcCls = lg.MovieClip;
                    clsName = "lg.MovieClip";
                }
            }
            if(mcCls == null) {
                throw  "There is no display with assetID: "+assetID+" in plist: "+plistFile;
            }
        }
       this._checkCreateFunc(mcCls, clsName);
       var mc = null;
       if(fromPool === true) {
           mc = lg.ObjectPool.get(plistFile,clsName,assetID).fetch(assetID, parent, params);
       }else{
           mc = mcCls.create(plistFile, assetID);
           if(params) mc.attr(params);
           if(parent) parent.addChild(mc);
           mc.clsName = clsName;
       }
       return mc;
   },
    _checkCreateFunc:function(target, clsName)
    {
        if(target == null) {
            throw "The class: "+clsName+" is not found!";
        }else if(target.create == null){
            throw "Please implement  a create(plistFile, assetID) method for the target class: "+clsName;
        }
    },
    addPlist:function(plistFile)
    {
        if(plistFile == null) {
            cc.log("Plist File can't be null!");
            return;
        }
        if(this.framesCache.containsKey(plistFile)) return false;
        var dict = this._getFrameConfig(plistFile);
//        var ext = lg.getFileExtension(plistFile);
        cc.spriteFrameCache.addSpriteFrames(plistFile);//, plistFile.replace("."+ext, ".png"));

        var frames = [];
        //parse the frames
        var frameDict = dict.frames;
        for(var key in frameDict)
        {
            frames.push(key);
        }
        //sort ascending
        frames.sort();

        this.framesCache.set(plistFile, frames);
    //    cc.log("frames: "+frames.length);

        //parse the displays defined in the plist
        if(dict.hasOwnProperty("displays"))
        {
            var displays = dict.displays;
            var displayNames = [];
            var dDefine = null;
            if(displays){
                for(var dName in displays)
                {
                    displayNames.push(dName);
                    dDefine = displays[dName];
                    dDefine.anchors = this._parseAnchors(dDefine.anchors);
                    this.displayDefineCache.set(plistFile + dName, dDefine);
                    this._parseSubAnims(plistFile, dName);
                }
            }
            this.displaysCache.set(plistFile, displayNames);
    //        cc.log("displays: "+displayNames.length);
        }
        //parse the movieClipgs
        if(dict.hasOwnProperty("mcs"))
        {
            var mcs = dict.mcs;
            for(var sName in mcs)
            {
                var mcDefine = mcs[sName];
                var mc = {};
                mc.type = mcDefine.type;
                mc.totalFrames = mcDefine.totalFrames;
                mc.labels = mcDefine.labels;
                mc.anchorX = mcDefine.anchorX;
                mc.anchorY = mcDefine.anchorY;
                mc.rect = this._strToRect(mcDefine.rect);
                mc.anchors = this._parseAnchors(mcDefine.anchors);
                mc.children = {};
                var childDefine;
                var childrenDefine = mcDefine.children;
                for(var childName in childrenDefine)
                {
                    childDefine = childrenDefine[childName];
                    var ch = mc.children[childName] = {};
                    ch.frames = this._strToArray(childDefine.frames);
                    ch.class = childDefine.class;
                    ch.zIndex = parseInt(childDefine.zIndex);
                    if(childDefine.hasOwnProperty("text")) {
                        ch.text = childDefine.text;
                        ch.align = childDefine.align;
                        ch.width = childDefine.width;
                        ch.height = childDefine.height;
                    }
                }
                this.mcsCache.set(plistFile + sName, mc);
                //see if there is a '$' sign which present sub animation of the mc
                this._parseSubAnims(plistFile, sName);
            }
        }
        //parse the fonts
        if(dict.hasOwnProperty("fonts"))
        {
            var fonts = dict.fonts;
            for(var fName in fonts)
            {
                this.fontsCache.set(plistFile + fName, fonts[fName]);
    //            cc.log("add font: "+fName);
            }
        }
        return true;
    },
    getFrameNames:function(plistFile, startFrame, endFrame)
    {
        if(!this.framesCache.containsKey(plistFile)) {
            this.addPlist(plistFile);
        }
        var frames = this.framesCache.get(plistFile);
        if(frames == null) return [];
        if(startFrame == -1) startFrame = 0;
        if(endFrame == -1) endFrame = frames.length - 1;
        return frames.slice(parseInt(startFrame), parseInt(endFrame) + 1);
    },
    getDisplayDefine:function(plistFile, assetID)
    {
        var key = plistFile + assetID;
        if(!this.displayDefineCache.containsKey(key))
        {
            this.addPlist(plistFile);
        }
        return this.displayDefineCache.get(key);
    },
    getDisplayNames:function(plistFile)
    {
        if(!this.displaysCache.containsKey(plistFile))
        {
            this.addPlist(plistFile);
        }
        return this.displaysCache.get(plistFile) || [];
    },
    getRandomDisplayName:function(plistFile)
    {
        var names = this.getDisplayNames(plistFile);
        var i = Math.floor(Math.random()*names.length);
        return names[i];
    },
    getMc:function(plistFile, assetID)
    {
        var key = plistFile + assetID;
        if(!this.mcsCache.containsKey(key)) {
            this.addPlist(plistFile);
        }
        return this.mcsCache.get(key);
    },
    getSubAnims:function(plistFile, theName)
    {
        var akey = plistFile + theName;
        return this.subAnimsCache.get(akey) || [];
    },
    getFont:function(plistFile, fontName)
    {
        var key = plistFile + fontName;
        if(!this.fontsCache.containsKey(key)) {
            this.addPlist(plistFile);
        }
        return this.fontsCache.get(key);
    },
    _parseSubAnims:function(plistFile, assetID)
    {
        var aarr = assetID.split("$");
        var rname = aarr[0];
        var aname = aarr[1];
        if(rname && aname && rname != '' && aname != ''){
            var akey = plistFile + rname;
            var anims = this.subAnimsCache.get(akey);
            if(anims == null) {
                anims = [];
                this.subAnimsCache.set(akey, anims);
            }
            anims.push(aname);
        }
    },
    _parseAnchors:function(anchorDict)
    {
        var dict = {};
        if(anchorDict == null) return dict;
        for(var name in anchorDict)
        {
            dict[name] = this._strToArray(anchorDict[name]);
        }
        return dict;
    },
    _strToArray:function(str)
    {
        var frames = str.split("|");
        var i = -1;
        var sArr = [];
        while(++i < frames.length)
        {
            var frame = frames[i];
            if(frame === "null") sArr.push(null);
            //"" means the params is the same as prev frame
            else if(frame === "") sArr.push(sArr[i - 1]);//sArr.push("");
            else sArr.push(this._strToArray2(frame));
        }
        return sArr;
    },
    _strToArray2:function(str)
    {
        var fs = str.split(",");
        for(var fi = 0; fi < fs.length; fi++)
        {
            if(fs[fi].indexOf(".") > -1) fs[fi] = parseFloat(fs[fi]);
            else fs[fi] = parseInt(fs[fi]);
        }
        return fs;
    },
    _strToRect:function(str)
    {
        var arr = str.split(",");
        return cc.rect(parseFloat(arr[0]), parseFloat(arr[1]), parseFloat(arr[2]), parseFloat(arr[3]));
    },
    /**
     * Copy from the cocos2d engine!
     * Get the real data structure of frame used by engine.
     * @param url
     * @returns {*}
     * @private
     */
    _getFrameConfig : function(url){
        var dict = cc.loader.getRes(url);
        if(!dict) throw "Please load the resource first : " + url;
        var frameCache = cc.spriteFrameCache;
        cc.loader.release(url);//release it in loader
        if(dict._inited){
            frameCache._frameConfigCache[url] = dict;
            return dict;
        }
        var tempFrames = dict["frames"], tempMeta = dict["metadata"] || dict["meta"];
        var frames = {}, meta = {};
        var format = 0;
        if(tempMeta){//init meta
            var tmpFormat = tempMeta["format"];
            format = (tmpFormat.length <= 1) ? parseInt(tmpFormat) : tmpFormat;
            meta.image = tempMeta["textureFileName"] || tempMeta["textureFileName"] || tempMeta["image"];
        }
        for (var key in tempFrames) {
            var frameDict = tempFrames[key];
            if(!frameDict) continue;
            var tempFrame = {};

            if (format == 0) {
                tempFrame.rect = cc.rect(frameDict["x"], frameDict["y"], frameDict["width"], frameDict["height"]);
                tempFrame.rotated = false;
                tempFrame.offset = cc.p(frameDict["offsetX"], frameDict["offsetY"]);
                var ow = frameDict["originalWidth"];
                var oh = frameDict["originalHeight"];
                // check ow/oh
                if (!ow || !oh) {
                    cc.log("cocos2d: WARNING: originalWidth/Height not found on the cc.SpriteFrame. AnchorPoint won't work as expected. Regenrate the .plist");
                }
                // Math.abs ow/oh
                ow = Math.abs(ow);
                oh = Math.abs(oh);
                tempFrame.size = cc.size(ow, oh);
            } else if (format == 1 || format == 2) {
                tempFrame.rect = frameCache._rectFromString(frameDict["frame"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = frameCache._pointFromString(frameDict["offset"]);
                tempFrame.size = frameCache._sizeFromString(frameDict["sourceSize"]);
            } else if (format == 3) {
                // get values
                var spriteSize = frameCache._sizeFromString(frameDict["spriteSize"]);
                var textureRect = frameCache._rectFromString(frameDict["textureRect"]);
                if (spriteSize) {
                    textureRect = cc.rect(textureRect.x, textureRect.y, spriteSize.width, spriteSize.height);
                }
                tempFrame.rect = textureRect;
                tempFrame.rotated = frameDict["textureRotated"] || false; // == "true";
                tempFrame.offset = frameCache._pointFromString(frameDict["spriteOffset"]);
                tempFrame.size = frameCache._sizeFromString(frameDict["spriteSourceSize"]);
                tempFrame.aliases = frameDict["aliases"];
            } else {
                var tmpFrame = frameDict["frame"], tmpSourceSize = frameDict["sourceSize"];
                key = frameDict["filename"] || key;
                tempFrame.rect = cc.rect(tmpFrame["x"], tmpFrame["y"], tmpFrame["w"], tmpFrame["h"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = cc.p(0, 0);
                tempFrame.size = cc.size(tmpSourceSize["w"], tmpSourceSize["h"]);
            }
            frames[key] = tempFrame;
        }
        var cfg = frameCache._frameConfigCache[url] = {
            _inited : true,
            frames : frames,
            meta : meta
        };
        return dict;
    }
});

lg.AssetsManager.create = function()
{
    var am = new lg.AssetsManager();
    am.init();
    return am;
};