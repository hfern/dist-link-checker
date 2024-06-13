import { glob } from 'glob';

import { fromHtml } from 'hast-util-from-html';
import { selectAll } from 'hast-util-select';


import { readFile } from 'fs/promises';


const IMG_TYPES = ["png", "jpg", "jpeg", "gif", "svg", "webp"];


interface Link {
    to: string,
    hash: string,
}

interface FileMetadata {
    fullRelativePath: string,
    anchors: Set<string>,
    outgoingLinks: Set<string>,
    outgoingImages: Set<string>,
}

interface SiteDB {
    pages: Map<string, FileMetadata>,
    images: Set<string>,
    errors: string[],
}


interface OnInvalidLinkParams {
    file: string,
    link: string,
    hash: string,
}

interface OnInvalidImageParams {
    file: string,
    image: string,
}


interface ValidateLinksOptions {
    dir: string,
    onInvalidLink?: (link: OnInvalidLinkParams) => void,
    onInvalidImage?: (image: OnInvalidImageParams) => void,
}

interface ValidationResult {
    ok: boolean,

    checkedLinks: number,
    checkedImages: number,
    totalChecked: number,

    brokenLinks: number,
    brokenImages: number,
    totalBroken: number,

    tookMillis: number,
}


export async function validateFolder(options: ValidateLinksOptions): Promise<ValidationResult> {
    // glob everything under the dir *.html
    // iterate each file and print 
    const startTime = performance.now();

    const files = glob.sync(`${options.dir}/**/*.html`);
    const images = glob.sync(`${options.dir}/**/*.{${IMG_TYPES.join(',')}}`);

    const onInvalidLink = options.onInvalidLink || ((_) => { });
    const onInvalidImage = options.onInvalidImage || ((_) => { });

    // page database: relative link to set of string (anchor ids) -> 
    let pageDb = new Map<string, FileMetadata>();
    let siteDb: SiteDB = {
        pages: pageDb,
        errors: [],
        images: new Set(images.map((img) => img.replace(options.dir, ''))),
    };

    await Promise.all(files.map(async (file) => {
        const relativeFile = file.replace(options.dir, '/').replace('//', '/').replace("/index.html", '/');
        const fileMetadata = await loadFile(options.dir, file);
        pageDb.set(relativeFile, fileMetadata);
    }))

    let linkCount = 0;
    let linkErrors = 0;

    let imageCount = 0;
    let imageErrors = 0;


    await Promise.all([...pageDb.entries()].map(async ([relPage, metadata]) => {
        for (const aHref of metadata.outgoingLinks.values()) {
            linkCount++;

            if (!validateLink(relPage, aHref, siteDb)) {
                linkErrors++;
                onInvalidLink({
                    file: metadata.fullRelativePath,
                    link: aHref,
                    hash: parseLink(aHref).hash,
                });
            }
        }

        for (const img of metadata.outgoingImages.values()) {
            imageCount++;

            if (!siteDb.images.has(img)) {
                imageErrors++;
                onInvalidImage({
                    file: metadata.fullRelativePath,
                    image: img,
                });
            }
        }
    }))

    const endTime = performance.now();
    const tookMillis = endTime - startTime;

    return {
        ok: linkErrors + imageErrors == 0,

        checkedLinks: linkCount,
        checkedImages: imageCount,
        totalChecked: linkCount + imageCount,

        brokenLinks: linkErrors,
        brokenImages: imageErrors,
        totalBroken: linkErrors + imageErrors,

        tookMillis: tookMillis,
    }
}


async function loadFile(dir: string, file: string): Promise<FileMetadata> {
    const fileContent = await readFile(file, 'utf-8');
    const hast = fromHtml(fileContent);

    const outgoing = await getOutgoingLinks(hast);
    const anchors = await getAnchors(hast);

    return {
        fullRelativePath: file.replace(dir, ''),
        outgoingLinks: outgoing,
        outgoingImages: await getImages(hast),
        anchors: anchors,
    }
}


async function getOutgoingLinks(hast): Promise<Set<string>> {
    const anchorElements = selectAll('a[href]', hast);
    let links = new Set<string>();

    for (const anchor of anchorElements) {
        if (!anchor.properties.href) {
            continue;
        }

        const href = anchor.properties.href as string;

        if (href.startsWith('https://') || href.startsWith('http://')) {
            continue;
        }

        links.add(href);
    }

    return links;
}

async function getAnchors(hast): Promise<Set<string>> {
    const anchorElements = selectAll('*[id]', hast);
    let anchors = new Set<string>();

    for (const anchor of anchorElements) {
        if (!anchor.properties.id) {
            continue;
        }
        anchors.add(anchor.properties.id as string);
    }

    return anchors;
}

async function getImages(hast): Promise<Set<string>> {
    const imgElements = selectAll('img[src]', hast);
    let images = new Set<string>();

    for (const img of imgElements) {
        if (!img.properties.src) {
            continue;
        }

        const src = img.properties.src as string;


        if (!(src.startsWith('/') || src.startsWith('.'))) {
            continue;
        }

        for (const type of IMG_TYPES) {
            if (src.endsWith("." + type)) {
                images.add(src);
                break;
            }
        }
    }

    return images;
}

function parseLink(href: string): Link {
    // if hash in href, split it
    const fields = href.split('#', 2);

    return {
        to: fields[0],
        hash: fields.length > 0 ? fields[1] : '',
    }
}

function validateLink(relativePage: string, aHref: string, siteDb: SiteDB): boolean {
    const link = parseLink(aHref);

    let toPage;

    if (link.to == "") {
        toPage = siteDb.pages.get(relativePage);
    } else {
        toPage = siteDb.pages.get(link.to) || siteDb.pages.get(link.to + '/');
    }

    if (!toPage) {
        return false;
    }

    if (link.hash && !toPage.anchors.has(link.hash)) {
        return false;
    }

    return true;
}
