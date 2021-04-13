
 {
	"blog" : (entry) => { 
		//
		if ( !(entry.abstract) ) {
			let abstract_tag = document.getElementById('floating-info-entry-include-abstract')
			abstract_tag.style.display = "none"
			return false
		}
		//
		let doc = document.getElementById('floating-info-special-type-blog')
		doc.innerHTML = !(entry.decoded) ? decodeURIComponent(entry.txt_full) : entry.txt_full
		//
		return true
	},
	"demo" : (entry) => { return false },
	"stream" : (entry) => { 
		let poster = document.getElementById('asset-type-stream-poster')
		poster.style.display = "none"
		let sound = document.getElementById('asset-type-stream-sound')
		sound.style.display = "none"
		let video = document.getElementById('asset-type-stream-video')
		video.style.display = "none"
		//
		let media = entry.media
		//
		let media_type = entry.media_type
		if ( media_type === 'image' ) {
			if ( poster ) {
				if ( entry.blob ) {
					poster.src = entry.blob
				} else {
					poster.src = media.poster
				}
				poster.style.display = "block"
			}
		} else if ( media_type === 'video' ) {
			if ( video ) {
				video.poster = media.poster
				if ( entry.blob && !(media.protocol)) {  // testing
					video.src = entry.blob
				} else if ( entry.use_protocol ) {
					let v_proto = media.protocol
					let v_cid = media[v_proto]
					let v_codec = {
						"type" : "video",
						"video" : 'video/mp4; codecs="avc1.64001e"'
					}
					media_startup(video,v_codec,v_proto,v_cid,media.source)
				} else {
					video.src = media.source
				}
				video.style.display = "block"
			}
		} else {	//  sound
			if ( sound ) {
				//let ext = extract_sound_media_ext(media.source)
				let sound_player = document.getElementById(`asset-type-stream-sound`)
				//let sound_player = document.getElementById(`asset-type-stream-sound-${ext}`)
				if ( sound_player ) {
					if ( entry.blob && !(media.protocol) ) {  // testing
						sound_player.src = entry.blob
					} else if ( entry.use_protocol ) {
						let a_proto = media.protocol		// a is for audio
						let a_cid = media[a_proto]
						let a_codec = {
							"type" : "audio",
							"audio" : 'audio/mp4; codecs="mp4a.40.2"'
						}
						media_startup(sound_player,a_codec,a_proto,a_cid,media.source)
					} else {
						sound_player.src = media.source
					}
					sound_player.style.display = "block"
				}
				if ( poster ) {
					poster.src = media.poster
				}
				sound.style.display = "block"
				poster.style.display = "block"
			}
		}
		
		return true 
	},
	"links" : (entry) => {
		let links = entry.links
		if ( links ) {
			let list = document.getElementById('asset-type-links-list')
			if ( list ) {
				list.innerHTML = ""
				let n = links.length
				for ( let i = 0; i < n; i++ ) {
					link = links[i]
					let element = document.createElement('li')
					let anchor = document.createElement('a')
					anchor.href = link
					anchor.id = `links-${i}-${entry._dash_entry_id}`  
					anchor.innerHTML = link
					anchor.target = "copious-check-links"  // tab name
					app_anchor_make_dragdrop_source(anchor)
					element.appendChild(anchor)
					list.appendChild(element)
				}
			}
		}
		return true
	}
}
