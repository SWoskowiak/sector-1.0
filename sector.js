/*
	Author: Stefan Woskowiak
	███████╗███████╗ ██████╗████████╗ ██████╗ ██████╗         ██╗███████╗
	██╔════╝██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗        ██║██╔════╝
	███████╗█████╗  ██║        ██║   ██║   ██║██████╔╝        ██║███████╗
	╚════██║██╔══╝  ██║        ██║   ██║   ██║██╔══██╗   ██   ██║╚════██║
	███████║███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║██╗╚█████╔╝███████║
	╚══════╝╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝ ╚════╝ ╚══════╝
	Get a handle on getting sites done quickly for various projects

	NOTES:
		Requires jQuery

	Includes:
		Sector - main object that has basic controls to represent "sections"
		Viewport - a simple object that has test functions to give relative to viewport results on a jquery object

*/

(function ($) {
	'use strict';

	// Main site object that handles all sections of our site
	window.Sector = function (initial_config) {

		// Behaviors of a site "Section" ( essentially a node in a doubly-linked list )
		var Section = function (config) {
			var self = this;
			this.visible = false;
			this.element = config.element;
			this.next = this.prev = this.key = false;
			this.load = function (vars) { self.visible = true; config.load(vars); return self;};
			this.unload = function (vars) { if (!self.visible) return false; self.visible = false; config.unload(vars); return self;};
			this.update = function (visible, direction, position) {config.update(visible, direction, position);};
			this.deeplink = function (vars) { if ( config.deeplink ) config.deeplink(vars); };
		};

		// Internal vars
		var sections = [],
			length = 0,
			current = 0,
			paused = false;

		// Merge defaults and main_config
		var defaults = {
				loop: true // next and prev cycle back around or not
			},
			main_config = {};

		$.extend(main_config, defaults, initial_config);

		////////////////////////////////////////////////////////////////////////////
		// Public methods //////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////

		// Adds a section to our site based on the config passed in
		function addSection(config) {
			// Our new section
			var new_section = new Section(config);
			// Set key based on array size
			new_section.key = sections.length;
			// Setup potential next/prev
			if (sections.length > 0) {
				sections[sections.length - 1].next = new_section;
				new_section.prev = sections[sections.length - 1];
			} else {
				current = new_section;
			}
			// Bind section data to selector in case we need it
			config.element.data('section', new_section);
			sections.push(new_section);
			length = sections.length;
		}

		// Update all sections that are in the viewport if we care to, otherwise update all
		function update(check_viewport) {
			// Don't update anything if we are paused
			if (paused) return false;

			var i = 0;
			// Update all things within the viewport
			if (check_viewport) {
				for (i; i < length; i++) {
					// Skip hidden elements
					if (sections[i].element.is(':hidden')) continue;
					// Test view percentage of element
					var results = Viewport.inViewport(sections[i].element);
					// Update if visible
					if (results && results.visible > 0) {
						// If visible has not been tripped yet call Load
						if (!sections[i].visible) sections[i].load();
						// Update ourselves while we are in view
						var position = typeof results.position !== 'undefined' ? results.position : 0;
						sections[i].update(results.visible, results.direction, position);
					} else {
						if (sections[i].visible) sections[i].unload();
					}
				}
			// Update regardless of being in view
			} else {
				for (i; i < length; i++) {
					sections[i].update();
				}
			}
		}

		// Some interface basics
		function pause() { paused = true; }
		function unpause() { paused = false; }
		function getSections() { return sections; }
		function moveTo(target, options) {
			options = options || {};
			if (typeof target === 'number') target = sections[target];
			// Determine direction 1 == 'back' -1 == 'foward'
			options.direction = !options.override ? current.key < target.key ? 1 : -1 : options.direction;
			// Account for looping so we keep transition directions preserved
			if (options._looped) options.direction *= -1;
			current.unload(options);
			current = target.load(options);
		}
		// Don't unload current just load new one
		function jumpTo(target, options) {
			options = options || {};
			if (typeof target === 'number') target = sections[target];
			options.direction = current.key < target.key ? 1 : -1;
			current = target.load(options);
		}
		function getCurrent() { return current; }

		// Build next function out based on config
		var next = (function () {
			if (main_config.loop) {
				return function (options) {
					options = options || {};
					options._looped = true;
					if (current.next) moveTo(current.next); else moveTo(sections[0], options);
				};
			} else {
				return function (options) {
					if (current.next) moveTo(current.next, options);
				};
			}
		}());
		// Build prev function out based on config
		var prev = (function () {
			if (main_config.loop) {
				return function (options) {
					options = options || {};
					options._looped = true;
					if (current.prev) moveTo(current.prev); else moveTo(sections[sections.length - 1], options);
				};
			} else {
				return function (options) {
					if (current.prev) moveTo(current.prev, options);
				};
			}
		}());


		////////////////////////////////////////////////////////////////////////////
		// Return interface ////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////
		return {
			update : update,
			add : addSection,
			pause: pause,
			next: next,
			prev: prev,
			moveTo: moveTo,
			jumpTo: jumpTo,
			getSections: getSections,
			unpause: unpause,
			getCurrent: getCurrent
		};
	};

	// inView Module
	window.Viewport = (function () {
		var _window = $(window),
			height = _window.height(),
			vtop = (window.pageYOffset || document.scrollTop)  - (document.clientTop || 0),
			vbottom = vtop + height;

		// Returns the vertical percentage (0.0 - 1.0) that an object is in the viewport by.
		// Note: this is NOT the percentage of the object thats in view but rather the percentage of the view the object occupies vertically
		// If object is fully within the viewport ( even if only a slim percentage of the viewport ) it will return 1
		function inViewport($element) {
			var etop = $element.offset().top,
				ebottom = etop + $element.height();
//console.log('dev:', $element.height());
			// Out of view entirely
			if ( (ebottom < vtop) || (etop > vbottom)) {
				return {visible: 0, direction: 0};
			// Takes up entire viewport ( and stretches outside of it)
			} else if ( (etop <= vtop) && (ebottom > vbottom) ) {
				return {visible: 1, direction: 0, position : (vbottom - etop) / $element.height()};

			// Fully inside viewport but not taking up the entirety of it
			} else if ( etop >= vtop && ebottom < vbottom) {
				return {visible: 1, direction: 0};

			// Transitioning out/in of view towards the top of the page
			} else if ( (etop < vtop) && (ebottom < vbottom) ) {
				//return {visible: (ebottom - vtop) / ( vbottom - vtop), direction: -1};
				return {visible: (ebottom - vtop) / $element.height(), direction: -1};

			// Transitioning out/in of view towards the bottom of the page
			} else if ( (etop > vtop && etop < vbottom) && (ebottom > vbottom) ) {
				//return {visible: (vbottom - etop) / ( vbottom - vtop), direction: 1};
				return {visible: (vbottom - etop) / $element.height(), direction: 1};

			}
		}

		// Returns the vertical percentage of the elements top in relation to the viewport top ( 0 if vertically below )
		function fromTopofViewport($element) {
			var etop = $element.offset().top,
				ebottom = etop + $element.height();

			// Below viewport's bottom
			if (etop > vbottom) {
				return 0;
			// Calc percentage from viewport top
			} else {
				return (vbottom - etop) / ( vbottom - vtop);
			}
		}

		// Bind ourselves to scroll and resize and set values accordingly
		_window.scroll(function () {
			vtop = _window.scrollTop();
			//vtop = top;
			vbottom = vtop + height;
		});
		_window.resize(function () {
			height = _window.height();
		});

		// Return interface
		return {
			inViewport : inViewport,
			fromTopofViewport: fromTopofViewport
		};
	}());

})(jQuery);
