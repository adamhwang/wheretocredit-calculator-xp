// ==UserScript==
// @name         wheretocredit.com calculator
// @namespace    https://github.com/adamhwang/wheretocredit-calculator-xp
// @version      1.2.0
// @description  Displays the number of frequent flyer miles you can earn with Expedia, Orbitz, Travelocity, Hotwire, Cheaptickets, Hotels.com, Wotif, ebookers, MrJet and SNCF! (all unaffiliated)
// @author       wheretocredit.com
// @include      http*://*.expedia.*/Flights-Search*
// @include      http*://*.expedia.*.*/Flights-Search*
// @include      http*://*.expedia-aarp.*/Flights-Search*
// @include      http*://*.travelocity.*/Flights-Search*
// @include      http*://*.orbitz.*/Flights-Search*
// @include      http*://*.cheaptickets.*/Flights-Search*
// @include      http*://*.voyages-sncf.*/Flights-Search*
// @include      http*://*.wotif.*/Flights-Search*
// @include      http*://*.wotif.*.*/Flights-Search*
// @include      http*://*.hotels.*/Flights-Search*
// @include      http*://*.*.hotels.*/Flights-Search*
// @include      http*://*.hotwire.*/Flights-Search*
// @include      http*://*.ebookers.*/Flights-Search*
// @include      http*://*.mrjet.*/Flights-Search*
// @include      http*://*.lastminute.*.*/Flights-Search*
// @grant        none
// ==/UserScript==

var main = function () {
    var calc;
    getData (function(data, offers) {
        calc = calc || $.ajax('//www.wheretocredit.com/api/2.0/calculate', {
            type : 'POST',
            contentType : 'application/json',
            dataType: 'json',
            data : JSON.stringify(data),
        });

        calc.then(function (results) {
            if (results.success) {
				injectCss();
		
                var ota = $('#header-logo img').attr('alt') || $.grep(window.location.hostname.split('.'), function (n, i) { return i > 0; }).join('.').replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });

                (function asyncLoop (i) {
                    if (i < results.value.length) {

                        var result = results.value[i];
                        if (result.success && result.value.totals && result.value.totals) {
                            // filter results
                            result.value.totals = $.grep(result.value.totals, function (total) { return total.rdm[0] > 0; });

							// order results
							result.value.totals.sort(function (a, b) {
								if (a.rdm[0] === b.rdm[0]) {
									return +(a.name > b.name) || +(a.name === b.name) - 1;
								}
								return b.rdm[0] - a.rdm[0]; // desc
							});

							var container = $(document.getElementById('flight-module-' + result.value.id.replace(/;/g, '_')));
							if (container.length) {
								var addDisclaimer = function (carrier) {
									if (carrier == 'UA' || carrier == 'DL' || carrier == 'AA') {
										return '<span title="Revenue-based earning is overestimated because taxes are included in the base fare." style="color: #f00; cursor: help;">*</span>';
									}
									return '';
								};

								var html =
									'<div class="wheretocredit-wrapper secondary">' +
									'<div class="wheretocredit-container">' +
									(result.value.totals.length ? result.value.totals.map(function (seg, i) { return '<div class="wheretocredit-item">' + seg.rdm[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + addDisclaimer(seg.id) + '&nbsp;' + seg.name.replace(' ', '&nbsp;') + '&nbsp;miles</div>'; }).join('') : 'No known mileage earnings.') +
									'<div class="wheretocredit-disclaimer">Data provided by <a href="http://www.wheretocredit.com" target="_blank">wheretocredit.com</a> and is not affiliated or sponsored by ' + ota + '.  Your mileage may vary.</div>' +
									'</div>' +
									'</div>';

								container.append(html);

								// ga event
								var btn = container.find('button');
								if (btn.length) {
									var price = getOfferPrice(offers[result.value.id]);
									var value = (price - bestPrice) / bestPrice;
									value = Math.round(value * 1000); // ga only tracks ints
									btn.click(function () {
										wtcga('wtc.send', 'event', 'Trips', 'Select', ota, value);
									});
								}
							}
                        }

                        setTimeout(function() { asyncLoop(i+1); }, 0);
                    }
                })(0);
            }
        });
        
        var getOfferPrice = function (offer) { return offer.price.exactPrice; };
        var bestPrice = Math.min.apply(null, $.map(offers, getOfferPrice));
    });

    function getData (callback) {
        require(['jquery', 'flights', 'uitk'], function ($, flights, uitk) {
            var getSegments = function (leg) {
                return $.map($.grep(leg.timeline, function (timeline) { return timeline.segment; }), function (seg) {
                    return {
                        origin: seg.departureAirport.code,
                        destination: seg.arrivalAirport.code,
                        departure: new Date(seg.departureTime.dateTime),
                        carrier: seg.carrier.airlineCode,
                        operatingCarrier: seg.carrier.operatedBy ? (seg.carrier.operatedByAirlineCode || '??') : null,
                        bookingClass: seg.carrier.bookingCode,
                        flightNumber: seg.carrier.flightNumber
                    };
                });
            };
            
            flights.vent.on('uiModel.resetViewableOffers', function() {
                require(['uiModel'], function (uiModel) {
                    var data = $.map(uiModel.rawData.offers, function (offer, natrualKey) {
                        if (flights && flights.collections && flights.legsCollection)
                        {
                            return {
                                id: natrualKey,
                                segments: $.map(offer.legIds, function (legId) {
                                    var leg = flights.collections.legsCollection.models[0].attributes[legId];
                                    return getSegments(leg);
                                })
                            };
                        }
                        return {
                            id: natrualKey,
							baseFare: offer.price.exactPrice,
							currency: offer.price.currencyCode,
                            segments: $.map(offer.legs, getSegments)
                        };
                    });
					data.sort(function (a, b) {
						return a.baseFare - b.baseFare; // asc
					});
                    callback(data, uiModel.rawData.offers);
                });
            });
        });
    }

    function injectCss() {
        var style = '<style type="text/css">' +
                        '.flight-module { padding-right: 180px !important; }' +
                        '.wheretocredit-wrapper { height: 100%; position: absolute; top: 0; right: 0; background: #F2F8FD; }' +
                        '.wheretocredit-wrapper:hover .wheretocredit-disclaimer { display: block; }' +
                        '.wheretocredit-disclaimer { display: none; font-size: .8em; padding-top: 1.4em; }' +
                        '.wheretocredit-container { height: 100%; width: 180px; overflow-y: scroll; overflow-x: hidden; padding: .7em; font-size: .9em; }' +
                        '.wheretocredit-container::-webkit-scrollbar { width: 6px; }' +
                        '.wheretocredit-container::-webkit-scrollbar-thumb { background-color: #6E99BA; }' +
                        '.wheretocredit-item { text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }' +
                    '</style>';
        $(style).appendTo('head');
    }
};

if (window.require || window.jQuery) main(); // for greasemonkey/tampermonkey
else {
    // for chrome extensions
    var script = document.createElement('script');
    script.type = "text/javascript";
    script.textContent = '(' + main.toString() + ')();';
    document.body.appendChild(script);
}

// ga
var script = document.createElement('script');
script.type = "text/javascript";
script.textContent = '!function(a,b,c,d,e,f,g){a.GoogleAnalyticsObject=e,a[e]=a[e]||function(){(a[e].q=a[e].q||[]).push(arguments)},a[e].l=1*new Date,f=b.createElement(c),g=b.getElementsByTagName(c)[0],f.async=1,f.src=d,g.parentNode.insertBefore(f,g)}(window,document,"script","https://www.google-analytics.com/analytics.js","wtcga"),wtcga("create","UA-60492056-7","auto","wtc"),wtcga("wtc.send","pageview");';
document.body.appendChild(script);