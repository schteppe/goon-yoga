require([
	'goo/entities/GooRunner',
	'goo/loaders/DynamicLoader',

	'goo/animation/layer/AnimationLayer',
	'goo/animation/state/SteadyState',
	'goo/animation/blendtree/ManagedTransformSource',
	'goo/animation/layer/LayerLERPBlender',

	'goo/entities/components/ScriptComponent',

	'goo/math/Vector3',
	'goo/math/Quaternion',
	'goo/math/Matrix3x3',
	'js/YogaScript'
], function (
	GooRunner,
	DynamicLoader,

	AnimationLayer,
	SteadyState,
	ManagedTransformSource,
	LayerLERPBlender,

	ScriptComponent,

	Vector3,
	Quaternion,
	Matrix3x3,
	YogaScript
) {
	'use strict';

	function init() {
		// Create typical Goo application
		var goo = new GooRunner({
			antialias: true,
			logo: 'bottomleft',
			manuallyStartGameLoop: true
		});

		// The loader takes care of loading the data
		var loader = new DynamicLoader({
			world: goo.world,
			rootPath: 'res'
		});

		loader.loadFromBundle('project.project', 'root.bundle', {recursive: false, preloadBinaries: true}).then(function(configs) {

			// This code will be called when the project has finished loading.
			var goon = loader.getCachedObjectForRef('bind_goon/entities/RootNode.entity');
			var clip = loader.getCachedObjectForRef('idle_a/animations/idle_a.clip');

			setupAnimationControl(goon, clip);

			goo.renderer.domElement.id = 'goo';
			document.getElementById('goo-wrapper').appendChild(goo.renderer.domElement);

			// Start the rendering loop!
			goo.startGameLoop();

		});
	}
	/**
	 * Creates a {@link ManagedTransformSource} and a control script for looking
	 * at the mouse pointer
	 * @param {Entity} Entity
	 * @param {AnimationClip} clip
	 */
	function setupAnimationControl(entity, clip) {
		//console.log();

		var jointNames = clip._channels.map(function(a){
			return a._jointName;
		});
		jointNames.sort();

		// A list of joints with names and other properties
		var joints = [];
		for(var i=0; i!==jointNames.length; i++){
			joints.push({
				name: jointNames[i]
			});
		}

		jointNames = joints.map(function(joint) {
			return joint.name;
		});

		// Add an animationlayer and get the source to control
		var clipSource = addManagedLayer(entity, clip, jointNames);

		var script = new YogaScript({
			clipSource: clipSource,
			joints: joints,
			origo: [0,0.4,0],
			maxValue : 10
		});

		// Add the controlScript
		entity.setComponent(
			new ScriptComponent(script)
		);

		// Dat GUI though
		var gui = new dat.GUI();
		var transformations = script.settings.transformations;
		function onChange(){
			script.settings.setHash();
		}
		gui.add(script.settings, 'reset');
		gui.add(script.settings, 'randomizeThree');
		gui.add(script.settings, 'addRandomized');
		for(var i=0; i !== joints.length; i++){
			var joint = joints[i];
			script.settings[joint.name] = transformations.none;
			script.settings.keys.push(joint.name);
			gui.add(script.settings, joint.name, transformations).listen().onChange(onChange);
		}
		script.settings.loadFromHash();
	}

	/**
	 * Creates an {@link AnimationLayer} with a playing {@link ManagedTransformSource}
	 * and adds it to the entity's animationComponent
	 * @param {Entity} entity
	 * @param {AnimationClip} clip
	 * @param {string[]} jointNames Names of jointChannels which the managedTransformSource
	 * will control
	 * @returns {ManagedTransformSource}
	 */
	function addManagedLayer(entity, clip, jointNames) {
		// Clipsource
		var clipSource = new ManagedTransformSource('Managed Clipsource');
		clipSource.initFromClip(clip, 'Include', jointNames);

		// State
		var state = new SteadyState('Managed State');
		state.setClipSource(clipSource);

		// Animation Layer
		var layer = entity.animationComponent.layers[0];
		layer.setState('managed', state);
		layer.setCurrentStateByName('managed');

		return clipSource;
	}

	init();
});
