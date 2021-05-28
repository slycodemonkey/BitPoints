var decks = {
	'standard': [
		{ value: NaN, estimate: '?' },
		{ value: 0, estimate: '0' },
		{ value: 0.5, estimate: '&frac12;' },
		{ value: 1, estimate: '1' },
		{ value: 2, estimate: '2' },
		{ value: 3, estimate: '3' },
		{ value: 5, estimate: '5' },
		{ value: 8, estimate: '8' },
		{ value: 13, estimate: '13' },
		{ value: 20, estimate: '20' },
		{ value: 40, estimate: '40' },
		{ value: 100, estimate: '100' },
		{ value: Infinity, estimate: '&infin;' },
		{ value: NaN, estimate: '<i class="fa fa-coffee"></i>' },
		{ value: NaN, estimate: 'ಠ_ಠ'}
	],
	'fibonacci': [
		{ value: NaN, estimate: '?' },
		{ value: 0, estimate: '0' },
		{ value: 1, estimate: '1' },
		{ value: 2, estimate: '2' },
		{ value: 3, estimate: '3' },
		{ value: 5, estimate: '5' },
		{ value: 8, estimate: '8' },
		{ value: 13, estimate: '13' },
		{ value: 21, estimate: '21' },
		{ value: 34, estimate: '34' },
		{ value: 55, estimate: '55' },
		{ value: 89, estimate: '89' },
		{ value: Infinity, estimate: '&infin;' },
		{ value: NaN, estimate: '<i class="fa fa-coffee"></i>' },
		{ value: NaN, estimate: 'ಠ_ಠ'}
	],
	'letters': [
		{ value: 0, estimate: 'A' },
		{ value: 1, estimate: 'B' },
		{ value: 2, estimate: 'C' },
		{ value: 3, estimate: 'D' },
		{ value: 4, estimate: 'E' },
		{ value: 5, estimate: 'F' },
		{ value: NaN, estimate: '?' },
		{ value: NaN, estimate: '<i class="fa fa-coffee"></i>' }
	],
	'tshirt': [
		{ value: 0, estimate: 'XS' },
		{ value: 1, estimate: 'S' },
		{ value: 2, estimate: 'M' },
		{ value: 3, estimate: 'L' },
		{ value: 4, estimate: 'XL' },
		{ value: NaN, estimate: '?' },
		{ value: Infinity, estimate: '&infin;' },
		{ value: NaN, estimate: '<i class="fa fa-coffee"></i>' }
	]
};

var socket = io.connect('http://'+window.location.host);
var roomId = BP.room.roomId;
var title = BP.room.title;
var votes = {};
var voters = {};
var voteData = {};
var voting = false;

// 0 - start, 1 - betting open, 2 - reveal
var roundStatus = 0;

var userTemp =  '<li data-name="{{name}}" data-uid="{{uid}}">'+
				'<div title="Don\'t count this voter\'s estimates" class="ಠ_ಠ"><i class="fa fa-eye"></i></div>'+
				'<div title="Remove this voter from room" class="kickVoter">&times;</div>'+
				'<img class="voterImage" src="{{avatar}}" />'+
				'<h3 class="voterName">{{name}}</h3>'+
				'<div class="card">'+
					'<div class="cardBack"></div>'+
					'<div class="cardInner">'+
						'<div class="cardValue"></div>'+
						'<div class="cornerValue topleft"></div>'+
						'<div class="cornerValue bottomright"></div>'+
					'</div>'+
				'</div>'+
			'</li>';

var ticketTemp = '<a href="{{url}}" class="key" target="_blank">{{key}}</a>: <span class="title">{{title}}</span>';

var getDeck = function() {
	return decks[$('input[name=deckType]:checked').val() || 'standard'];
};

var useNearestRounding = function() {
	return $('input[name=roundNearest]:checked').val();
};

var displayAverage = function() {
	return $('input[name=displayAverage]:checked').val();
};

var getNearestCard = function(average, deck) {
  var compareArr = [];
  BP.each(deck, function(card) {
    if(!isNaN(card.value)) {
      compareArr.push(card);
    }
  });

  var curr = compareArr[0];
  var diff = Math.abs (average - curr.value);
  BP.each(compareArr, function(compareVal) {
    var newdiff = Math.abs (average - compareVal.value);
    if (newdiff < diff) {
      diff = newdiff;
      curr = compareVal;
    }
  });

  return curr;
};

var getNumVotes = function() {
	var count = 0;
	BP.each(votes,function() {
		count++;
	});
	return count;
};

var processVotes = function() {
	voteData = {
		votes: votes,
		average: -1,
		trueAverage: -1,
		min: -1,
		max: -1,
		allVotesEqual: true,
		lastVote: -1,
		total: 0,
		numVotes: 0,
		spread: 0
	};

	var deck = getDeck();
	var nearestRounding = useNearestRounding();
	var minCardIdx = 0, maxCardIdx = 0;

	BP.each(votes, function(vote) {
		if(!isNaN(vote)) {
			voteData.total += vote;
			if(voteData.lastVote === -1){
				voteData.lastVote = vote;
				voteData.min = vote;
				voteData.max = vote;
			}
			if(voteData.lastVote !== vote){ voteData.allVotesEqual = false; }
			if(voteData.max < vote){ voteData.max = vote; }
			if(voteData.min > vote){ voteData.min = vote; }
			voteData.numVotes++;
		}
	});

	BP.each(deck, function(card, i) {
		if(card.value === voteData.min) { minCardIdx = i; }
		if(card.value === voteData.max) { maxCardIdx = i; }
	});

	voteData.spread = maxCardIdx - minCardIdx;

	voteData.average = voteData.numVotes === 0 ? 0 : voteData.total / voteData.numVotes;

	if (nearestRounding) {
	    voteData.nearestCard = getNearestCard(voteData.average, deck);
	}

  if (voteData.average > 0.5) {
    voteData.trueAverage = voteData.average;
    voteData.average = Math.round(voteData.average);
  }

};

var page = new BP.Page({

	socket: socket,

	domRoot: '#room',

	socketEvents: {
		'newVoter': 'addVoter',
		'voterLeave': 'removeVoter',
		'updateTicket': 'updateTicket',
		'newVote': 'acceptVote'
	},

	domEvents: {
		'change input[name=deckType]': 'updateVoterDecks',
		'click .ಠ_ಠ': 'ಠ_ಠ',
		'click .kickVoter': 'kickVoter',
		'click .setting': 'toggleSettingMenu',
		'click #showLink': 'showShareLink',
		'click #toggleRound': 'toggleRound'
	},

	DOM: {
		users: '#users',
		ticket: '#ticket',
		average: '#average',
		nearestCard: '#nearestCard',
		largeSpread: '#largeSpread'
	},

	initialize: function() {
		socket.emit('createRoom', {roomId: roomId, title: title});
		this.useNotifications = BP.localStorage.get('useNotifications');
		var inviteId = $('#showLink').attr('data-link');
		var inviteLinkMarkup = document.location.host + '/<strong>' + inviteId + '</strong>';
		$('#showLink').attr('data-link', inviteLinkMarkup);
		$('#inviteUrl').html(inviteLinkMarkup);

	},

	addVoter: function(data) {
		voters[data.uid] = data;
		data.name = $('<span></span>').html(data.name).text();
		var html = BP.template(userTemp, data);
		$(html).appendTo(this.$users);
		this.updateVoterDecks();
		socket.emit('updateVoters', {roomId: roomId, voters: voters});

		// emit the appropriate voting state for the new voter to pick up on
		if (voting) {
			socket.emit('newRound', {roomId: roomId, ticket: BP.currentTicket});
		} else {
			socket.emit('roundEnd',{roomId: roomId});
		}
	},

	removeVoter: function(data) {
		delete votes[data.uid];
		delete voters[data.uid];
		this.$('li[data-uid="' + data.uid + '"]').remove();
		socket.emit('updateVoters', {roomId: roomId, voters: voters});
	},

	updateTicket: function(data) {
		BP.currentTicket = data;
		this.$ticket.html(BP.template(ticketTemp, data));
	},

	acceptVote: function(data) {
		if(roundStatus === 1){
			var
				$voter = this.$('li[data-uid="'+data.uid+'"]'),
				$card = $voter.find('.card'),
				$mainValue = $card.find('.cardValue'),
				$cornerValues = $card.find('.cornerValue'),
				$cardBack = $card.find('.cardBack');

			$mainValue.html(data.cardValue);
			$cornerValues.html(data.cardValue);
			if(data.cardValue === 'coffee') {
				$mainValue.addClass('coffee');
				$cornerValues.addClass('coffee');
			}
			$cardBack.css('background-color', data.color).attr('class', 'cardBack').addClass(data.pattern);
			$cardBack.css('background-image', 'url(/images/cards/' + data.pattern + '.png)');
			$card.addClass('visible');

			if(!$voter.data('observer'))
				votes[data.uid] = data.value;

			if(this.useNotifications && getNumVotes() === this.$users.find('li:not([data-observer=true])').length) {
				BP.Notification.send({
					title: 'BitPoints - '+BP.room.title,
					body: 'All votes are in!'
				});
			}

		}
	},

	updateVoterDecks: function() {
		socket.emit('deckChange',getDeck());
	},

	ಠ_ಠ: function(e, $el) {
		$el.parent().attr('data-observer', $el.parent().attr('data-observer') !== 'true');
	},

	kickVoter: function(e, $el) {
		socket.emit('kickVoter',{roomId:roomId,uid:$el.parent().data('uid')});
	},

	toggleSettingMenu: function(e, $el) {
		$el.siblings().find('.drop').removeClass('active');
		$el.next('.drop').toggleClass('active');
	},

	showShareLink: function(e, $el) {
		var link = $el.data('link'),
			modal = new BP.Modal({
				id: 'inviteLink',
				content: link,
				size: 'large'
			});

		modal.show();
	},

	startNewRound: function(e, $el) {
		voting = true;
		this.$average.hide().find('.val').empty();
		this.$nearestCard.hide().find('.val').empty();
		this.$largeSpread.hide();
		$el.text('Stop Estimating');
		this.$('.card').removeClass('visible showValue spin');
		$('html').addClass('voting');

		// Clear out all votes
		votes = {};

		// wait until cards are fully hidden to remove classes and emit events
		window.setTimeout(function(){
			this.$('.cardValue').removeClass('coffee min max');
			this.$('.cornerValue').removeClass('coffee');
			socket.emit('newRound', {roomId: roomId, ticket: BP.currentTicket});
		}.bind(this), 1500);
	},

	endCurrentRound: function(e, $el) {
		voting = false;
		$el.text('Begin Estimating');
		this.$('.card').addClass('showValue');
		$('html').removeClass('voting');

		processVotes();
        var showAverage = displayAverage();

		// If there's only one person, vote data is useless
		if(voteData.numVotes > 1) {

			// Log info for advanced users
			console.log(votes);
			console.log(voteData);

			var averageText;
			if (voteData.trueAverage > -1 && voteData.average !== voteData.trueAverage) {
				averageText = voteData.trueAverage.toFixed(2);
				if (voteData.average > voteData.trueAverage) {
					averageText += ', rounded up';
				} else if (voteData.average < voteData.trueAverage) {
					averageText += ', rounded down';
				}
			} else {
				averageText = voteData.average + ' on the money';
			}

			var outcomeText = voteData.average;
			if (voteData.spread > 3) {
				outcomeText += '*';
				averageText += ' - The vote spread is large';
			}

			var nearestText = '';
			if (voteData.nearestCard) {
        nearestText = voteData.nearestCard.estimate;
        this.$nearestCard.show().find('.val').text(nearestText);
			}

            if (showAverage) {
			    this.$average.show().find('.val').text(outcomeText);
			    this.$average.show().find('.val').attr('title', averageText);
            }

			// Animate fun-times if everyone votes the same
			if(voteData.numVotes >= 2 && voteData.allVotesEqual){
				this.$('.card').addClass('spin');
			}
		}

		socket.emit('roundEnd',{
			roomId: roomId,
			roundData: voteData,
			outcome: outcomeText,
      nearestCard: nearestText
		});
	},

	toggleRound: function(e, $el){

		roundStatus = (roundStatus % 2) + 1;

		if(roundStatus === 1) {
			this.startNewRound(e, $el);
		} else if(roundStatus === 2) {
			this.endCurrentRound(e, $el);
		}
	}
});

page.init();
