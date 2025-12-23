// sidebar.js

// Toggle sidebar on mobile
function toggleSidebar() {
	var x = document.querySelector(".root");
	if (x.classList.contains("sidebar-open")) {
		x.classList.remove("sidebar-open");
	} else {
		x.classList.add("sidebar-open");
	}
}

// Sidebar link highlighting
// Updates url hash and sidebar highlights while scrolling
let container = document.querySelector("html");
let content = document.querySelector(".doc");
let sidebar = document.querySelector(".sidebar");
let root = document.querySelector(":root");

let elemMap = new WeakMap();
let observedActiveElems = [];

function setActive(el) {
	observedActiveElems.push(el);
	el.dataset.observedActive = true;
	let sidebarElem = elemMap.get(el);
	sidebarElem.classList.add("active");
}

let minDepth = 1;
let setHashMode = 0; // set to 2 to enable hash setting
function getHeaderDepth(el) {
	let ret = {
		depth: 0,
		invalidElement: false,
		beneathMinDepth: false,
		noSidebarLink: false,
		get error() {
			return (
				this.invalidElement ||
				this.beneathMinDepth ||
				this.noSidebarLink
			);
		},
	};
	if (el.nodeName.length != 2 || el.nodeName[0] != "H") {
		ret.invalidElement = true;
	} else {
		ret.depth = Number(el.nodeName[1]);
		if (Number.isNaN(ret.depth)) {
			ret.invalidElement = true;
		} else if (ret.depth < minDepth) {
			ret.beneathMinDepth = true;
		}
	}
	if (!elemMap.has(el)) {
		ret.noSidebarLink = true;
	}
	return ret;
}
function setHash(el) {
	if (!el.id.length) {
		return false;
	}
	history.replaceState({}, "", "#" + encodeURIComponent(el.id));
	return true;
}
function processEl({ targetEl, highlightNextElements, setHashMode }) {
	let baseDepth = null;
	let baseEl = null;

	let key = "previousElementSibling";
	{
		let elDepth = getHeaderDepth(targetEl);
		if (!elDepth.invalidElement && elDepth.beneathMinDepth) {
			key = "nextElementSibling";
		}
	}

	for (let el = targetEl; !baseDepth; el = el[key]) {
		if (!el) {
			return;
		}
		if (setHashMode == 1 && setHash(el)) {
			setHashMode = 0;
		}
		let elDepth = getHeaderDepth(el);
		let setBg = true;
		if (
			!elDepth.invalidElement &&
			!elDepth.beneathMinDepth &&
			elDepth.noSidebarLink
		) {
			setBg = false;
		} else if (elDepth.error) {
			continue;
		}
		elDepth = elDepth.depth;
		baseEl = el;
		baseDepth = elDepth;
		for (let el; (el = observedActiveElems.pop()); ) {
			let sidebarElem = elemMap.get(el);
			sidebarElem.classList.remove("active");
			delete el.dataset.observedActive;
		}
		if (setHashMode == 2) {
			setHash(el);
		}
		if (setBg) {
			setActive(el);
		}
		break;
	}

	for (
		let el = baseEl.previousElementSibling, currDepth = baseDepth;
		el && currDepth > minDepth;
		el = el.previousElementSibling
	) {
		let elDepth = getHeaderDepth(el);
		if (elDepth.error || elDepth.depth != currDepth - 1) {
			continue;
		}
		setActive(el);
		currDepth -= 1;
	}

	if (highlightNextElements) {
		for (
			let el = baseEl.nextElementSibling, currDepth = baseDepth;
			el;
			el = el.nextElementSibling
		) {
			let elDepth = getHeaderDepth(el);
			if (elDepth.error) {
				if (highlightNextElements == 2) {
					break;
				} else {
					continue;
				}
			}
			if (elDepth.depth <= currDepth) {
				break;
			}
			if ((currDepth += 1) >= 10) {
				throw "malformed html";
			}
			setActive(el);
		}
	}
}

if (content != null) {
	let skipObserver = false,
		csp = container.scrollTop;
	let randomEl = document.createElement("br");
	let ioo = new IntersectionObserver(
		function (entries) {
			let sp = csp;
			csp = container.scrollTop;
			if (skipObserver) {
				ioo.unobserve(randomEl);
				skipObserver = false;
				return;
			}
			for (let entry of entries) {
				let target = entry.target;
				if (entry.isIntersecting) {
					if (csp <= sp) {
						processEl({
							targetEl: target,
							highlightNextElements: true,
							setHashMode: setHashMode,
						});
						break;
					}
				} else if (
					entry.boundingClientRect.bottom <= container.clientHeight
				) {
					// element goes OFF THE TOP OF THE VIEWPORT
					let el = target.nextElementSibling;
					if (el) {
						processEl({
							targetEl: el,
							highlightNextElements: true,
							setHashMode: setHashMode,
						});
					}
				} else if (target.dataset.observedActive) {
					// element goes OFF THE BOTTOM OF THE VIEWPORT
					let el = target.previousElementSibling;
					if (el) {
						processEl({
							targetEl: el,
							highlightNextElements: false,
							setHashMode: setHashMode,
						});
					}
				}
			}
			return;
		},
		{
			root: null,
			threshold: 0,
		},
	);

	for (let el of content.children) {
		let sidebarElem = sidebar.querySelector(
			`[data-doc-association="${el.id}"]`,
		);
		if (sidebarElem) {
			elemMap.set(el, sidebarElem);
		}
		ioo.observe(el);
	}

	addEventListener(
		"hashchange",
		(function hashchange(_event) {
			if (location.hash.length <= 1) {
				return hashchange;
			}
			let el = container.querySelector(location.hash);
			if (!el) {
				return hashchange;
			}
			skipObserver = true;
			ioo.observe(randomEl);
			processEl({
				targetEl: el,
				highlightNextElements: true,
				setHashMode: 0,
			});
			return hashchange;
		})(),
	);
}
