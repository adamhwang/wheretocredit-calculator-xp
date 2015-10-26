// ==UserScript==
// @name         wheretocredit.com calculator - Expedia
// @namespace    https://github.com/adamhwang/wheretocredit-calculator
// @version      0.1
// @description  wheretocredit.com calculator for Expedia and Travelocity
// @author       wheretocredit.com
// @include      http*://*.expedia.*/Flights-Search*
// @include      http*://*.expedia.*/Flight-SearchResults*
// @include      http*://*.travelocity.*/Flights-Search*
// @include      http*://*.travelocity.*/Flight-SearchResults*
// @grant        none
// ==/UserScript==

var $;

getData(function(data, selectFn) {
    injectCss();
    $.ajax('//www.wheretocredit.com/api/beta/calculator', {
        type : 'POST',
        contentType : 'application/json',
        dataType: 'json',
        data : JSON.stringify(data),
        success: function (results, selector) {
            if (results.success) {
                
                (function asyncLoop (i) {                    
                    if(i < results.value.length) {
                        
                        var result = results.value[i];
                        if (result.success && result.value.totals && result.value.totals.length) {
                            // filter results
                            result.value.totals = $.grep(result.value.totals, function (total) { return total.value > 0; });

                            // order results
                            result.value.totals.sort(function (a, b) {
                                if (a.value === b.value) {
                                    return +(a.name > b.name) || +(a.name === b.name) - 1;
                                }
                                return b.value - a.value; // desc
                            });

                            var container = $(selectFn(result.value.id));
                            var height = container.height();
                            
                            var addDisclaimer = function (carrier) {
                                if (carrier == 'UA' || carrier == 'DL') {
                                    return '<span title="Revenue-based earning is only calculated for USD-denominated, multi-city searches and will not include carrier imposed surcharges (YQ/YR)." style="color: #f00; cursor: help;">*</span>';
                                }
                                return '';
                            };
                            
                            var html = '<div class="wheretocredit-wrap" style="top: -' + (height+1) + 'px">' +
                                           '<div class="wheretocredit-container" style="height: ' + (height-1-20) + 'px;">' +
                                               result.value.totals.map(function (seg, i) { return '<div class="wheretocredit-item">' + seg.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + addDisclaimer(seg.id) + ' ' + seg.name + ' miles</div>'; }).join('') +
                                           '</div>' +
                                       '</div>';
                            
                            container.length && container.after(html);
                        }
                        
                        setTimeout(function() { asyncLoop(i+1); }, 0);
                    }
                    else {
                        var disclaim = $('<div class="wheretocredit-disclaimer">Mileage calculations provided by <a href="http://www.wheretocredit.com" target="_blank">wheretocredit.com</a> and are not affiliated or sponsored by Expedia.</div>');
                        disclaim.prependTo('.wheretocredit-wrap:first');
                        disclaim.css('top', -1 * disclaim.height() - 20 + 'px');
                    }
                })(0);
            }
        }
    });
});

function getData (callback) {
    if (window.require) {
        require(['jquery', 'flights', 'uitk'], function (jQuery, flights, uitk) {
            $ = jQuery;
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

            if (flights.vent) {
                // round trips search results
                flights.vent.on('offerListView.renderComplete', function () {
                    var data = $.map(flights.views.applicationView.offerListView.collection.models, function (model) {
                        return {
                            id: model.attributes.naturalKey,
                            segments: $.map(model.attributes.legIds, function (legId) {
                                var leg = flights.collections.legsCollection.models[0].attributes[legId];
                                return getSegments(leg);
                            })
                        };
                    });
                    callback(data, function (id) { return 'div[data-offer-natural-key="' + id + '"]'; });
                });
            }
            else if (uitk.subscribe) {
                // one way search results
                uitk.subscribe('Flights.ModuleBuilder.Controller.renderComplete', function() {
                    require(['loyaltyPoints'], function (loyaltyPoints) {
                        var data = $.map(loyaltyPoints.modulesCache, function (module) {
                            return {
                                id: module.index,
                                segments: $.map(module.legs, getSegments)
                            };
                        });
                        callback(data, function (id) { return '#flightModule' + id; });
                    });
                });
            }
            else {
                // unknown result page
            }
        });
    }
    else {
        // multi-city search results
        $ = jQuery;
        $(function() {
            var results = JSON.parse($('#jsonData').text());
            var data = $.map(results, function (result, i) { 
                return {
                    id: i,
                    ticketingCarrier: result.fare.ticketingAirCarrierCodes.length ? result.fare.ticketingAirCarrierCodes[0] : null,
                    baseFareUSD: result.fare.pricePerPassengerType.ADULT && result.fare.pricePerPassengerType.ADULT.currencyCode == 'USD' ? result.fare.pricePerPassengerType.ADULT.basePrice : null, 
                    segments: $.map(result.legs, function (leg) {
                        return $.map(leg.segments, function (seg) {
                            return {
                                origin: seg.departureAirport.airportCode,
                                destination: seg.arrivalAirport.airportCode,
                                departure: new Date(seg.departureDate),
                                carrier: seg.airCarrierCode,
                                operatingCarrier: seg.operatingAirlineCode,
                                bookingClass: seg.bookingCode.trim(),
                                flightNumber: seg.flightNumber
                            };
                        });
                    })
                };
            });
            callback(data, function (id) { return '#flightModuleControl' + id; });
        });
    }
}

function injectCss() {
    var style = '<style type="text/css">' +
                    '.wheretocredit-wrap { height: 0; right: -230px; position: relative; float: right; font-size: 8pt; }' +
                    '.wheretocredit-disclaimer { position: absolute; left:0; background: #fff; border: solid 1px #ccc; padding: 10px; }' +
                    '.wheretocredit-container { float: left; overflow-y: scroll; background: #fff; border: solid 1px #ccc; padding: 10px; }' +
                    '.wheretocredit-item { width: 180px; white-space: nowrap; text-overflow: ellipsis; }' +
                '</style>';
    $(style).appendTo('head')
}