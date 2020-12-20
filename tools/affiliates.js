
const fs = require('fs')

// //
let output_dir = process.argv[2]



function load_affiliate_db() {
    let data = fs.readFileSync("affiliates.json",'ascii').toString()
    return JSON.parse(data)
}


const MY_OCCUR_THESHOLD = 2

function count_occurances(key,text) {
    let next_find = 0
    let occurs = 0
    while ( next_find >= 0 ) {
        next_find = text.indexOf(key,next_find)
        if ( next_find > 0 ) occurs++
    }
    return(occurs)
}


class AffiliateGenerator {
    //
    constructor(file_conf) {
        this.web_links_list = []
        let deprefixed = (file_conf.file_path.substr(0,2) === 't_') ? file_conf.file_path.replace('t_','').trim() : file_conf.file_path.trim()
        let source_dir = file_conf.source_dir ? file_conf.source_dir : '.'
        this.out_file =  ( file_conf.output_spec !== undefined ) ?  
                                (`${output_dir}/${file_conf.output_spec}`) :
                                (`${output_dir}/${deprefixed}`)
        this.placement_symbol = file_conf.symbol
        if ( file_conf.template_file ) {
            let path = `./${source_dir}/${file_conf.file_path}`
            this.template = fs.readFileSync(path,'ascii').toString()
        } else {
            this.template = false
        }
        this.about_keys = file_conf.about
    }
    //
    add_link(link) {
        this.web_links_list.push(link)
    }
    //
    appropos(link_descr) {          // AI
        //
        let l_keys = link_descr.keys
        let score = 0
        this.about_keys.forEach(key => {
            if ( key in l_keys ) {
                score++
            }
        })
        //
        this.about_keys.forEach(key => {
            let occurances = count_occurances(key,link_descr.text)
            if ( occurances > MY_OCCUR_THESHOLD ) score++
        })
        //
        if ( this.template ) {
            l_keys.forEach(key => {
                let occurances = count_occurances(key,this.template)
                if ( occurances > MY_OCCUR_THESHOLD ) score++
            })    
        }
        //
        console.log(score + " " + link_descr.text)
        return(score > 0.5)  // false  // how much??
    }
    //
    generate_output() {
        //
        let configured = this.web_links_list.map(link => {
            return(link.txt)
        })
        //
        if ( configured.length ) {
            let all_link_txt = configured.join('/n')
            if ( this.template === false ) {
                return all_link_txt
            } else {
                let txt = this.template
                txt = txt.replace(this.symbol,all_link_txt)
                return txt
            }
        } else if ( this.template !== false ) {
            let txt = this.template
            txt = txt.replace(this.placement_symbol,'')
            return txt
        }
        //
    }
    //
    async generate() {
        let output = this.generate_output()
        let ofile = this.out_file
        fs.writeFile(ofile,output,() => {
            console.log(ofile)
        })
    }
    //
}



function main() {
    //
    let affiliate_db = load_affiliate_db()
    let generators = affiliate_db.all_files.map(file => {
        return(new AffiliateGenerator(file))
    })
    affiliate_db.affiliates.forEach(affiliate => {
        generators.forEach(generator => {
            if ( generator.appropos(affiliate.description) ) {
                generator.add_link(affiliate.link)
            }
        })
    })
    //
    generators.forEach(gen => {
        gen.generate()
    })
}


main()