/* 
 *  CoreMob Camera
 *  Cordova App for Windows Phone 8
 * 
 *  W3C Core Mobile Web Platform Community Group
 */
 
var CoreMobCamera = (function() {
	
	var maxFilesize = 1048576 * 3.5; // Max image size is 3.5MB (iPhone5, Galaxy SIII, Lumia920 < 3MB)
	var numPhotosSaved = 0;
	var imgCrop;
	var finalPhotoDimension = 612;
	var viewWidth;

	
	// UI
	var loader = document.getElementById('loader'),
		firstRun = document.getElementById('firstrun'),		
		originalPhoto = document.getElementById('originalPhoto'),
		resultPhoto = document.getElementById('resultPhoto'),
		sectionMain = document.getElementById('main'),
		sectionPhotoEffect = document.getElementById('photoEffect'),
		sectionFilterDrawer = document.getElementById('filterDrawer'),
		sectionSingleView = document.getElementById('singleView');  
	
	return {
		init: init
	};
	
	function init() {
		var prefetchImg = new Image();
		prefetchImg.src = 'img/effects-thumbs.png';
		var prefetchImg2 = new Image();
		prefetchImg2.src = 'img/effects/bokeh-stars.png';
		
		viewWidth = (window.innerWidth < finalPhotoDimension) ? window.innerWidth : finalPhotoDimension;
		
		bindEvents();		
		openDatabase();
		
		// Cordova
		pictureSource = navigator.camera.PictureSourceType;
		destinationType = navigator.camera.DestinationType;
	}
	
	function showUI(uiElem) {
		uiElem.removeAttribute('hidden');
	}
	
	function hideUI(uiElem) {
		uiElem.setAttribute('hidden', 'hidden');
	}
	
	function openDatabase() {
		CoreMobCameraiDB.openDB(dbSuccess, dbFailure);
		function dbSuccess(dbPhotos) {
			createGallery(dbPhotos);
		}
		function dbFailure() {
			renderFirstRun();
			document.getElementById('saveButton').setAttribute('disabled', 'disabled');
	    }
	}
	
	function reInit() {
		hideUI(firstRun);
		hideUI(sectionPhotoEffect);
		hideUI(sectionFilterDrawer);
		hideUI(sectionSingleView);
		
		showUI(sectionMain);
		
		var index = numPhotosSaved-1;
		var q = '[data-index="' + index + '"]';
		
		var oldClone = document.querySelector('.swiper-wrapper');
		oldClone.parentNode.removeChild(oldClone);
		cloneThumbNode();
	}
	
    function renderFirstRun() {
	    showUI(firstRun);
	    var arrowHeight = window.innerHeight * .45;
		document.getElementsByClassName('arrow-container')[0].style.height = arrowHeight + 'px';
    }
       
	function bindEvents() {
		// Screen orientation/size change
		var orientationEvent = ('onorientationchange' in window) ? 'orientationchange' : 'resize';
		window.addEventListener(orientationEvent, function() {
		    displayThumbnails();
		}, false);

		// Cordova hook - A photo taken (or a file chosen) *********
		document.getElementById('capturePhoto').addEventListener('click', function() {
			showUI(loader);
			// Take picture using device camera and retrieve image as base64-encoded string
			navigator.camera.getPicture(onPhotoDataSuccess, onPhotoDataFail, { quality: 50,
				destinationType: destinationType.DATA_URL }
			);
		}, false);
		
	
		// Filter Effects selected
		document.getElementById('filterButtons').addEventListener('click', prepFilterEffect, false);
		
		// View a photo in carousel
		document.getElementById('thumbnails').addEventListener('click', viewSinglePhoto, false);
		
		// Pop back to Main
		window.addEventListener('popstate', function(e){
			console.log(history.state);
			//if (history.state == undefined || history.state.stage == 'main') {
				showUI(sectionMain);
				hideUI(sectionSingleView);
				hideUI(sectionPhotoEffect);
				hideUI(sectionFilterDrawer);
				
				history.replaceState({stage: 'main'}, null);
			//}
		}, false);
		
		// popstate alternative
		document.getElementById('dismissSingleView').addEventListener('click', function(e){
			e.preventDefault();
			if (typeof history.pushState === 'function')	{
				history.go(-1); // pop one state manially
			}
			showUI(sectionMain);
			hideUI(sectionSingleView);
		}, false);		
		

		// Uploading a photo
		document.getElementById('shareButton').addEventListener('click', function(e){
			e.preventDefault();
			var photoid = parseInt(e.target.getAttribute('data-photoid'), 10);
	
			// get base64 from db then send
		    if (photoid) {
			    CoreMobCameraiDB.getPhotoFromDB(photoid, function(data) {
					startUpload(data);
			    });
			}		
		}, false);	
	
		// Save a photo in iDB as Base64
		document.getElementById('saveButton').addEventListener('click', savePhoto, false);
		
		// Delete a photo
		document.getElementById('singleView').addEventListener('click', function(e) {
			//console.log(e.target);
			if(e.target.classList.contains('delete-photo')) {
				var confirmDelete = confirm('Are you sure you want to delete the photo?');
				if(confirmDelete) {
					var deletingId = parseInt(e.target.getAttribute('data-id'));
					CoreMobCameraiDB.deletePhoto(deletingId, deleteCallback);	
				}
			}
			function deleteCallback() {
				CoreMobCameraiDB.listPhotosFromDB(reRenderCallback);
				
				function reRenderCallback(dbPhotos) {
					document.querySelector('.thumbnail-wrapper').innerHTML = '';
					document.querySelector('.swiper-container').innerHTML = '';
					createGallery(dbPhotos);
					reInit();
				}
			}
      	}, false);
      	
		// Delete All - temp
		document.getElementById('clearDB').addEventListener('click', function() {
			var confirmDelete = confirm('Are you sure you want to delete all photos?');
			if(confirmDelete) {
				CoreMobCameraiDB.deleteDB();	
			}		
		}, false);
	}

    function prepFilterEffect(e) {
    	var filterButton = getFilterButton(e.target);
		if(!filterButton) return;
		
    	showUI(loader);
		
		// Removing the previously created canvas
		var prevFilteredPhoto = document.getElementById('filteredPhoto');
		if(prevFilteredPhoto) {	
			prevFilteredPhoto.parentNode.removeChild(prevFilteredPhoto);
		}
			
		setTimeout(function(){
			ApplyEffects[filterButton.id](resultPhoto);
		}, 1);	
		
	    (function () {
	    	var newFilteredPhoto = document.getElementById('filteredPhoto');
			if(newFilteredPhoto) {
				console.log('canvas loaded!');
				newFilteredPhoto.style.width = newFilteredPhoto.style.height = viewWidth +'px';
				hideUI(loader);
			} else {
				console.log('canvas not loaded yet...');
				setTimeout(arguments.callee, 100);
			}
		})();
		
		function getFilterButton(target) {
			var button;
			if(target.classList.contains('filter')) {
				button = target;
			} else if (target.parentNode.classList.contains('filter')) {
				button = target.parentNode;
			}
			return button;
		}
    }
    
	/**
	 *  View a single photo from the Gallery
	 */
    function viewSinglePhoto(e) {
	        function setPhotoTarget(index) {
		    var photoId = document.querySelector('.swiper-container [data-index="' + index + '"]').getAttribute('data-photoid');
		    document.getElementById('shareButton').setAttribute('data-photoid', photoId);		    
		}

		if(e.target.classList.contains('thumb')) {
			var index = (e.target.dataset) ? parseInt(e.target.dataset.index) : parseInt(e.target.getAttribute('data-index'));
			var revIndex = numPhotosSaved - index - 1;
		        setPhotoTarget(index);
			var swiper = new Swiper('.swiper-container', { 
				pagination: '.pagination',
			        initialSlide: revIndex,
			        onSlideChangeEnd: function(s) {
				    setPhotoTarget(numPhotosSaved - s.activeSlide - 1);
				}
			});
			
			history.pushState({stage: 'singleView'}, null);
			showUI(sectionSingleView);
			hideUI(sectionMain);
		} 	
	}
		
	/**
	 * Save Photo (data url string) in iDB 
	 * saving blob is NOT supported WebView in WP8, although supported on IE10
	 */
	
    function savePhoto(e) {
    	var data = {};
		var canvas = document.getElementById('filteredPhoto') || document.getElementById('croppedPhoto');	
		
		if(!canvas) return;
		
		data.photo = canvas.toDataURL('image/jpeg');
		gotPhotoInfo(data);
	
		function gotPhotoInfo(data) {
			var d = new Date();
			data.title = d.toUTCString();
			
			CoreMobCameraiDB.putPhotoInDB(data, addSuccess, addFail);
			
			function addSuccess(dbPhotos){
				numPhotosSaved++;
				renderPhotos(dbPhotos);
				reInit();
			}
			
			function addFail(e) {
				console.log(e);
			}
		}

    }
    
	
	function createGallery(dbPhotos) {
		renderPhotos(dbPhotos);
		displayThumbnails();
		cloneThumbNode();
		scrollInfinitely();	
	}
	
	// Call back after iDB success
	function renderPhotos(dataArray) {

		var data;
		var wrapper = document.querySelector('.thumbnail-wrapper');

		if(dataArray.photo) { // a new photo added
			data = dataArray;
			var imgUrl = dataArray.photo;
			var el = thumb(dataArray, imgUrl, numPhotosSaved-1);
			wrapper.insertBefore(el, wrapper.firstChild);
			return;
		}

    	if (dataArray.length == 0) {
			renderFirstRun();
	    	return;
    	}
    	numPhotosSaved = dataArray.length;

	    firstRun.setAttribute('hidden', 'hidden');
    	    	
    	function thumb(data, imgUrl, index) {
	    	var el = document.createElement('figure');
	    	el.className = 'thumb';
	    	el.setAttribute('data-index', index);
	    	el.setAttribute('data-photoid', data.id);
	    	el.style.backgroundImage = 'url('+imgUrl+')';
	    	var cap = document.createElement('figcaption');
	    	cap.textContent = data.title;
	    	
	    	var a = document.createElement('a');
	    	a.className = 'delete-photo';
	    	a.setAttribute('data-id', data.id);
        	a.textContent = ' [delete]';
	    	
	    	el.appendChild(cap);
	    	el.appendChild(a);		
	    		
	    	return el;
    	}
        makeThumbsFromArray();
        
        function makeThumbsFromArray() {
	        var figureEl, imgUrl;
			setTimeout(function() {
				revokeDataUrls(dataArray.slice())
			}, 10);
		    while (data = dataArray.pop()) {
		    	if(data.photo) {
		    		imgUrl = data.photo;
			    	figureEl = thumb(data, imgUrl, dataArray.length);
			    	wrapper.appendChild(figureEl);
		    	}
			}   
        }		
		
		function revokeDataUrls(dataArrayCopy) {
			var URL = window.URL || window.webkitURL;
			for(var i = 0; i < dataArrayCopy.length; i++) {
				URL.revokeObjectURL(dataArrayCopy[i].photo);
			}
		}
    }
    
	function displayThumbnails(resizeScreen) {	
		var eachWidth = 105, // css .thumb
			thumbsPerRow = (window.innerWidth / eachWidth) >>> 0;
		
		document.getElementById('thumbnails').style.width = thumbsPerRow * eachWidth + 'px';
		
		var container = document.querySelector('.swiper-container');
		
		container.style.width = viewWidth +'px';
		container.style.height = (viewWidth + 40) + 'px';
	}
	
	function cloneThumbNode() {
		var container = document.querySelector('.swiper-container');
		var thumbNode = document.querySelector('.thumbnail-wrapper');
		var thumbViewNode = thumbNode.cloneNode(true);
	
		thumbViewNode.className = 'swiper-wrapper';
		var children = thumbViewNode.children;
		
		for (var i = 0; i < children.length; i++) {
			children[i].className = 'swiper-slide';
		}
		
		container.appendChild(thumbViewNode);
	}
	
	function scrollInfinitely() {
		// TO DO
	}
	
	function cropAndResize() {
		var photoObj = document.getElementById('originalPhoto');

	    imgCrop = new PhotoCrop(photoObj, {
			size: {w: finalPhotoDimension, h: finalPhotoDimension}
	    });
	    
		var newImg = imgCrop.getDataURL();
		imgCrop.displayResult();
		hideUI(document.getElementById('croppedPhoto')); //keep in DOM but not shown
		
		resultPhoto.src = newImg;
		resultPhoto.style.width = resultPhoto.style.height = viewWidth +'px';
		
		// Removing the previously created canvas, if any
		var prevEffect = document.getElementById('filteredPhoto');
		if(prevEffect) {	
			prevEffect.parentNode.removeChild(prevEffect);
			showUI(resultPhoto);
		}
		
		hideUI(sectionMain);
		showUI(sectionPhotoEffect);
		showUI(sectionFilterDrawer);
		hideUI(originalPhoto);
		
		history.pushState({stage: 'effectView'}, null);
	}
	


	
	/**
	 * Cordova - 
	 */
	 
	 // Camera Capture
	 
	 function onPhotoDataSuccess(imageData) {
	 	var orig = document.getElementById('originalPhoto');
        
	 	orig.onload = function() {
        	cropAndResize();	        
			hideUI(loader);
        };
        orig.src = 'data:image/jpeg;base64,' + imageData;
	 }
	 
	function onPhotoDataFail(message) {
		console.log('Capture failed: ' + message);
	}
	
	// File upload
	
	function startUpload(data) {
		var base64 = data.photo;		
		var fileURL;
		
		loader.textContent = 'Uploading...';
		showUI(loader);
		
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, onFileSystemFail);
		
		
		function gotFS(fileSystem) {
			console.log('gotFS called');
			console.log(fileSystem.name);
	        console.log(fileSystem.root.name);
		    fileSystem.root.getFile('base64.txt', {create: true, exclusive: false}, gotFileEntry, onFileSystemFail);
		}
	    
	    function gotFileEntry(fileEntry) {
        	fileEntry.createWriter(gotFileWriter, onFileSystemFail);
        	fileURL = fileEntry.toURL();
        	console.log(fileURL);
        }

        function gotFileWriter(writer) {
	        writer.onwriteend = function(evt) {
		        console.log('text file written');
		        startFileTransfer();
	        };
	        writer.write(base64);
	    }
       
	    function startFileTransfer() {
	    	console.log('startFileTransfer called');
	    	var now = new Date().getTime();
	    	
	    	var options = new FileUploadOptions();
            options.fileKey = 'txt';
            options.fileName = now + '.txt';
            options.mimeType = 'text/plain';
            
            var params = {};
            params.title = data.title;
            options.params = params;

            var ft = new FileTransfer();
            ft.upload(fileURL, encodeURI('http://mwcdemo.lan'), uploadSuccess, uploadFail, options);
	    }
	
	    function uploadSuccess(r) {
	    	hideUI(loader);
	    	loader.textContent = 'Processing...';
            reInit();
            
            console.log("Code = " + r.responseCode);
            console.log("Response = " + r.response);
            console.log("Sent = " + r.bytesSent);
        }

        function uploadFail(error) {
            alert("An error has occurred: Code = " + error.code);
            console.log("upload error source " + error.source);
            console.log("upload error target " + error.target);
            
            hideUI(loader);
	    	loader.textContent = 'Processing...';
            reInit();
        }
	    
	    function onFileSystemFail(e) {
	        console.log(e);
	    }
	}	
	
	
}());


document.addEventListener('deviceready', CoreMobCamera.init, false);