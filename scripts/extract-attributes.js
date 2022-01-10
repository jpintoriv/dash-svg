'use strict';

const fs = require('fs');
const path = require('path')
const cheerio = require('cheerio');
const request = require('request-promise');
const str = require('string');
const flatCache = require('flat-cache');

const svgURL = 'https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute';
const dataPath = './data/attributes.json';
const htmlPath = './data/attributes.html';

// From https://reactjs.org/docs/dom-elements.html#differences-in-attributes
//
const supportedAttributes = ['accentHeight', 'accumulate', 'additive', 'alignmentBaseline', 'allowReorder', 'alphabetic',
  'amplitude', 'arabicForm', 'ascent', 'attributeName', 'attributeType', 'autoReverse', 'azimuth',
  'baseFrequency', 'baseProfile', 'baselineShift', 'bbox', 'begin', 'bias', 'by', 'calcMode', 'capHeight',
  'clip', 'clipPath', 'clipPathUnits', 'clipRule', 'colorInterpolation',
  'colorInterpolationFilters', 'colorProfile', 'colorRendering', 'contentScriptType',
  'contentStyleType', 'cursor', 'cx', 'cy', 'd', 'decelerate', 'descent', 'diffuseConstant', 'direction',
  'display', 'divisor', 'dominantBaseline', 'dur', 'dx', 'dy', 'edgeMode', 'elevation', 'enableBackground',
  'end', 'exponent', 'externalResourcesRequired', 'fill', 'fillOpacity', 'fillRule', 'filter',
  'filterRes', 'filterUnits', 'floodColor', 'floodOpacity', 'focusable', 'fontFamily', 'fontSize',
  'fontSizeAdjust', 'fontStretch', 'fontStyle', 'fontVariant', 'fontWeight', 'format', 'from', 'fx', 'fy',
  'g1', 'g2', 'glyphName', 'glyphOrientationHorizontal', 'glyphOrientationVertical', 'glyphRef',
  'gradientTransform', 'gradientUnits', 'hanging', 'horizAdvX', 'horizOriginX', 'ideographic',
  'imageRendering', 'in', 'in2', 'intercept', 'k', 'k1', 'k2', 'k3', 'k4', 'kernelMatrix', 'kernelUnitLength',
  'kerning', 'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust', 'letterSpacing', 'lightingColor',
  'limitingConeAngle', 'local', 'markerEnd', 'markerHeight', 'markerMid', 'markerStart',
  'markerUnits', 'markerWidth', 'mask', 'maskContentUnits', 'maskUnits', 'mathematical', 'mode',
  'numOctaves', 'offset', 'opacity', 'operator', 'order', 'orient', 'orientation', 'origin', 'overflow',
  'overlinePosition', 'overlineThickness', 'paintOrder', 'panose1', 'pathLength',
  'patternContentUnits', 'patternTransform', 'patternUnits', 'pointerEvents', 'points',
  'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits',
  'r', 'radius', 'refX', 'refY', 'renderingIntent', 'repeatCount', 'repeatDur', 'requiredExtensions',
  'requiredFeatures', 'restart', 'result', 'rotate', 'rx', 'ry', 'scale', 'seed', 'shapeRendering', 'slope',
  'spacing', 'specularConstant', 'specularExponent', 'speed', 'spreadMethod', 'startOffset',
  'stdDeviation', 'stemh', 'stemv', 'stitchTiles', 'stopColor', 'stopOpacity',
  'strikethroughPosition', 'strikethroughThickness', 'string', 'stroke', 'strokeDasharray',
  'strokeDashoffset', 'strokeLinecap', 'strokeLinejoin', 'strokeMiterlimit', 'strokeOpacity',
  'strokeWidth', 'surfaceScale', 'systemLanguage', 'tableValues', 'targetX', 'targetY', 'textAnchor',
  'textDecoration', 'textLength', 'textRendering', 'to', 'transform', 'u1', 'u2', 'underlinePosition',
  'underlineThickness', 'unicode', 'unicodeBidi', 'unicodeRange', 'unitsPerEm', 'vAlphabetic',
  'vHanging', 'vIdeographic', 'vMathematical', 'values', 'vectorEffect', 'version', 'vertAdvY',
  'vertOriginX', 'vertOriginY', 'viewBox', 'viewTarget', 'visibility', 'widths', 'wordSpacing',
  'writingMode', 'x', 'x1', 'x2', 'xChannelSelector', 'xHeight', 'xlinkActuate', 'xlinkArcrole',
  'xlinkHref', 'xlinkRole', 'xlinkShow', 'xlinkTitle', 'xlinkType', 'xmlns', 'xmlnsXlink', 'xmlBase',
  'xmlLang', 'xmlSpace', 'y', 'y1', 'y2', 'yChannelSelector', 'z', 'zoomAndPan'];


// https://github.com/royriojas/flat-cache#readme

var pageCache = flatCache.load('pages', path.resolve('cache'));

const CACHE_TIMEOUT = 1000 * 24 * 60 * 60

const cacheSave = function(key, page) {
  const timeStamp = Date.now() + CACHE_TIMEOUT;
  const value = {timeStamp, page}
  pageCache.setKey(key, value)
  pageCache.save(true)
}

const cacheFetch = function(key) {
  const value = pageCache.getKey(key)
  if (value) {
    if (value.timeStamp > Date.now()) {
      return value.page
    }
    pageCache.removeKey(key);
    pageCache.save()
  }
  return undefined;
}


const fetchPage = async function(pageURL) {
  let page = cacheFetch(pageURL)
  if (! page) {
    console.log('Fetching %s', pageURL)
    try {
      page = await request(pageURL)
      cacheSave(pageURL, page)
    } catch (error) {
      console.log("Error loading %s", pageURL)
      page = "?????"
    }
  }
  return page
}

const getElementDetails = async function(href) {
  const pageURL = 'https://developer.mozilla.org' + href;
  try {
    const html = await fetchPage(pageURL)
    const $ = cheerio.load(html);
    const desc = $('p', 'article').text()
    return desc.split('.')[0]
  } catch (error) {
    console.log("Error loading %s", pageURL)
    return "?????"
  }
}

/**
 * From the MDN attributes reference, extract a map of attributes with
 * descriptions and supported elements.
 */
const extractAttributes = async function($) {

  const attributeList = [];

  "abcdefghijklmnopqrstuvwzyz".split('').forEach(letter => {
    const attributes = $(`h3[id=${letter}]`).next().find('a')
    attributes.each((i, attr) => {
      // console.log(cheerio(attr).text())

      const svgAttribute = str(cheerio(attr).text())
        .trim()
        // Convert e.g. `accept-charset` to `acceptCharset`
        .camelize()
        .toString();

      // Ensure attribute is supported by React
      if (!supportedAttributes.includes(svgAttribute)) {
        return;
      }

      const pageUrl = attr.attribs.href
      attributeList.push({svgAttribute, pageUrl})

    });
  });

  for (const i in attributeList) {
    const attr = attributeList[i]
    const description = await getElementDetails(attr.pageUrl)
    console.log("[%s]\n%s\n", attr.svgAttribute, description)
  }

  return attributeList;
}

/**
 * Create a map of elements to attributes e.g. {div: ['id', 'name']}
 */
function extractElements(attributes) {
    return Object.keys(attributes)
        .reduce((elementMap, attributeName) => {
            const attribute = attributes[attributeName];
            const elements = attribute.elements;

            elements.forEach((element) => {
                elementMap[element] = elementMap[element] || [];
                elementMap[element].push(attributeName);
            });

            return elementMap;
        }, {});
}

// A local copy of the MDN attributes web page has been saved for reference:
// fs.readFile('./data/attributes.html', 'utf-8', (error, html) => {

const extractAllAttributes = async function() {

  try {
    const html = await fetchPage(svgURL)
    const html2 = html.split(/\n\r|\r\n|\r|\n/).map(l => l.trimRight()).join('\n');

    // write back to the saved copy of MDN attributes so we can see the diff

    fs.writeFileSync(htmlPath, html2);

    const $ = cheerio.load(html);
    const attributes = await extractAttributes($);
    const elements = extractElements(attributes);

    const out = {
      attributes,
      elements
    };

    // Print out JSON with 4-space indentation formatting.
    // http://stackoverflow.com/a/11276104
    const tabWidth = 4;
    fs.writeFileSync(dataPath, JSON.stringify(out, null, tabWidth));
  } catch (e) {
    console.log(e)
  }

}

extractAllAttributes()
