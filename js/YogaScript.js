define([
	'goo/renderer/Renderer',
	'goo/math/Matrix3x3',
	'goo/math/Quaternion',
	'goo/math/Vector3',
	'goo/math/MathUtils',
	'goo/animation/clip/JointData'
], function(
	Renderer,
	Matrix3x3,
	Quaternion,
	Vector3,
	MathUtils,
	JointData
) {
	'use strict';

	function Settings(){
		this.keys = [];
		// n = none
		// R = rotation
		// S = scale
		// T = translation
		// s = sinusoidal
		// l = linear
		// x,y,z = axis

		// title : [nRST][nsl][nxyz]
		this.transformations = {
			'none' : 'nnn',
			'R.x = t' :'Rlx',
			'R.y = t' :'Rly',
			'R.z = t' :'Rlz',
			'R.x = sin(t)' :'Rsx',
			'R.y = sin(t)' :'Rsy',
			'R.z = sin(t)' :'Rsz',
			'scale.x = sin(t)' :'Ssx',
			'scale.y = sin(t)' :'Ssy',
			'scale.z = sin(t)' :'Ssz',
			'trans.x = sin(t)' :'Tsx',
			'trans.y = sin(t)' :'Tsy',
			'trans.z = sin(t)' :'Tsz',
		};

		var numTransformations = 0;
		for(var key in this.transformations){
			numTransformations++;
		}

		this.reset = function(){
			for(var i=0; i<this.keys.length; i++){
				var key = this.keys[i];
				this[key] = this.transformations.none;
			}
			this.setHash();
		};

		this.addRandomized = function(){

			// Pick random joint
			var idx = Math.floor((this.keys.length-1) * Math.random());
			var jointKey = this.keys[idx];

			// Pick random transformation
			var trans = this.transformations.none;
			var transIdx = Math.floor((numTransformations-1) * Math.random());
			var i = 0;
			for(var key in this.transformations){
				if(transIdx === i){
					trans = this.transformations[key];
					break;
				}
				i++;
			}

			// Set
			this[jointKey] = trans;

			this.setHash();
		};

		this.randomizeThree = function(){
			this.reset();
			for(var i=0; i<3; i++){
				this.addRandomized();
			}
			this.setHash();
		};

		// url#a=b.c.d&e=f.g.h
		this.setHash = function(){
			var hash = [];
			for(var i=0; i<this.keys.length; i++){
				var key = this.keys[i];
				if(this[key] != this.transformations.none)
					hash.push(i +'='+this[key]);
			}
			if(hash.length){
				document.location.hash = hash.join('&');
			} else {
				document.location.hash = "";
			}
		};

		this.loadFromHash = function(){
			if(!document.location.hash) return;
			var hash = document.location.hash.split('&');
			for(var i=0; i<hash.length; i++){
				var keyAndVal = hash[i].split('=');
				if(keyAndVal.length != 2){
					continue;
				}
				var keyIndex = parseInt(keyAndVal[0]);
				if(isNaN(keyIndex) || keyIndex < 0 || keyIndex >= this.keys.length){
					continue;
				}
				var key = this.keys[keyIndex];
				var val = keyAndVal[1];
				if(val.length != 3) continue;
				this[key] = val;
			}
		};
	}

	/**
	 * @class A very non-generic script to control where a goon looks
	 * @param {object} properties
	 * @param {ManagedTransformSource} properties.clipSource
	 * @param {object[]} properties.joints
	 * @param {number[3]} properties.origo Where the eyes are in world coordinates
	 */
	function YogaScript(properties) {
		properties = properties || {};
		this._blendWeight = 1;
		this._clipSource = properties.clipSource;

		this._joints = properties.joints;
		this._origo = new Vector3(properties.origo);
		this._azimuth = 0;
		this._ascent = 0;
		this._domElement = null;
		this._dirty = true;

		this.settings = new Settings();

		this.maxValue = 10;
	}

	// Calculation helpers (creating objects is heavy)
	var initMat = new Matrix3x3();
	var calcMat = new Matrix3x3();
	var newMat = new Matrix3x3();
	var newQuat = new Quaternion();
	var newScale = new Vector3(1,1,1);
	var calcScale = new Vector3(1,1,1);
	var newTrans = new Vector3();
	var calcTrans = new Vector3();

	/**
	 * Called by Goo Engine, will be executed every render loop
	 * @param {Entity} entity
	 * @param {number} tpf time per frame
	 * @param {object} env
	 * @param {DOMElement} env.domElement The canvas Goo is running on
	 */
	YogaScript.prototype.run = function(entity, tpf, env) {
		entity.animationComponent.layers[0].setBlendWeight(this._blendWeight);

		var world = entity._world;
		var s = this.settings;
		if (this._clipSource && this._joints) {
			for (var i = 0, len = this._joints.length; i < len; i++) {
				var joint = this._joints[i];
				var transformation = s[joint.name].split('');
				var t_type = transformation[0];
				var t_anim = transformation[1];
				var t_axis = transformation[2];

				var animVal = 0; // Always in [0, 1]
				switch(t_anim){
					case 'l':
						animVal = (world.time * 0.5);
						break;
					case 's':
						animVal = Math.sin(world.time) * 0.5 + 0.5;
						break;
				}

				// Store initial data
				if(!joint.initialData){
					joint.initialData = new JointData(this._clipSource.getChannelData(joint.name));
				}

				// Set rotation
				initMat.copyQuaternion(joint.initialData._rotation);
				calcMat.setIdentity();
				newScale.setd(1, 1, 1);
				calcScale.setd(1, 1, 1);
				newTrans.setv(joint.initialData._translation);
				newQuat.setv(joint.initialData._rotation);

				var v;
				switch(t_type){

					case 'n':
						// Do nothing
						break;

					case 'R':
						v = (animVal - 0.5)*Math.PI;
						calcMat.fromAngles(
							t_axis === 'x' ? v : 0,
							t_axis === 'y' ? v : 0,
							t_axis === 'z' ? v : 0
						);
						newQuat.fromRotationMatrix(Matrix3x3.combine(calcMat, initMat, newMat));
						break;

					case 'S':
						v = animVal + 1; // [1,2]
						calcScale.setd(
							t_axis === 'x' ? v : 1,
							t_axis === 'y' ? v : 1,
							t_axis === 'z' ? v : 1
						);
						Vector3.mul(joint.initialData._scale, calcScale, newScale);
						break;

					case 'T':
						v = animVal*0.5;
						calcTrans.setd(
							t_axis === 'x' ? v : 0,
							t_axis === 'y' ? v : 0,
							t_axis === 'z' ? v : 0
						);
						Vector3.add(joint.initialData._translation, calcTrans, newTrans);
						break;
				}


				this._clipSource.setRotation(joint.name, newQuat);
				this._clipSource.setScale(joint.name, newScale);
				this._clipSource.setTranslation(joint.name, newTrans);
			}
		}
	};

	return YogaScript;
});