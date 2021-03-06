let pako = require("pako");

class CRC {
	static createTable32() {
		CRC.TABLE32 = new Uint32Array(256);
		for (let i = 256; i--; ) {
			let tmp = i;

			for (let k = 8; k--; ) {
				tmp = tmp & 1 ? 3988292384 ^ (tmp >>> 1) : tmp >>> 1;
			}
			CRC.TABLE32[i] = tmp;
		}
	}

	static crc32(data) {
		if (!CRC.TABLE32) {
			CRC.createTable32();
		}

		let crc = -1; // Begin with all bits set ( 0xffffffff )
		for (let i = 0, l = data.length; i < l; i++) {
			crc = (crc >>> 8) ^ CRC.TABLE32[(crc & 255) ^ data[i]];
		}
		return (crc ^ -1) >>> 0; // Apply binary NOT
	}
}

class PNG160 {
	//VERY LIKELY TO HAVE PROBLEMS WITH THIRD PARTY IMAGES!
	//TODO: change IDAT size after edit
	static readPNGFile(data, metaDataSet, read) {
		if (isPng(data)) {
			let index = PNG160.PNG_HEADER.length;
			//PNG properties from IHDR:
			let width, height, bitdepth, colortype, filterType;
			let alldata = new Uint8Array();
			let earlyStop = false;

			//Read file
			while (index < data.length && !earlyStop) {
				let dataLength = bytesToInt32(data, index, index + 4);
				let chunktype = bytesToInt32(data, index + 4, index + 8);
				let nextIndex = index + 12 + dataLength;

				if (bitdepth && bitdepth != 16 && colortype != 0) {
					console.log("INCORRECT FORMAT");
					break;
				}

				switch (chunktype) {
					case bytesToInt32(PNG160.IHDR):
						width = bytesToInt32(data, index + 8, index + 12);
						height = bytesToInt32(data, index + 12, index + 16);
						bitdepth = data[index + 16];
						colortype = data[index + 17];
						filterType = data[index + 19];
						metaDataSet({ width: width, height: height, bitdepth: bitdepth, colortype: colortype, filterType: filterType });

						//If read not set, no reason to continue
						if (read == null) {
							earlyStop = true;
						}
						break;
					case bytesToInt32(PNG160.IDAT):
						let nextChunktype = bytesToInt32(data, nextIndex + 4, nextIndex + 8);
						let chunkdata = data.subarray(index + 8, index + 8 + dataLength);

						let temp = new Uint8Array(alldata.length + chunkdata.length);
						temp.set(alldata);
						temp.set(chunkdata, alldata.length);
						alldata = temp;

						if (nextChunktype != bytesToInt32(PNG160.IDAT)) {
							let imagedata = pako.inflate(alldata);
							let filter = new Filters(imagedata, width);

							//Undo existing filters:
							let linefilter = 0,
								imageIndex = 0;
							for (let i = 0; i < (height + 1) * width; i++) {
								if (i % (1 + width)) {
									switch (linefilter) {
										case 0: //Nothing filter
											break;
										case 1: // Sub
											imagedata[imageIndex] += filter.raw(imageIndex); //First byte
											imagedata[imageIndex + 1] += filter.raw(imageIndex + 1); //Second byte
											break;
										case 2: // Up
											imagedata[imageIndex] += filter.prior(imageIndex);
											imagedata[imageIndex + 1] += filter.prior(imageIndex + 1);
											break;
										case 3: //Average
											imagedata[imageIndex] += filter.average(imageIndex);
											imagedata[imageIndex + 1] += filter.average(imageIndex + 1);
											break;
										case 4: //Paeth
											imagedata[imageIndex] += filter.paeth(imageIndex);
											imagedata[imageIndex + 1] += filter.paeth(imageIndex + 1);
											break;
									}

									read(width, i - 1 - ((i / (width + 1)) >> 0), bytesToInt16(imagedata, imageIndex));
									imageIndex += 2;
									filter.xindex++;
								} else {
									linefilter = imagedata[imageIndex];

									imagedata[imageIndex] = 0x00;
									imageIndex++;
									filter.xindex = 0;
								}
							}
						}
						break;
					case bytesToInt32(PNG160.IEND):
						break;
					default:
						let charcode = new TextDecoder("utf-8").decode(getInt32Bytes(chunktype).buffer);
						let hexcode = tohex(getInt32Bytes(chunktype));
						console.log("Unprocced chunk -> charcode: " + charcode + " hexcode: " + hexcode);
						break;
				}

				index += 12 + dataLength; //Move on to next block
			}
		}
	}
	static getRawImage(pngfile, dataconverter) {
		dataconverter = dataconverter
			? dataconverter
			: value => {
					return value;
			  };

		let image = {};
		PNG160.readPNGFile(
			pngfile,
			metadata => {
				image.data = new Uint16Array(metadata.width * metadata.height);
				image.height = metadata.height;
				image.width = metadata.width;
			},
			(width, i, value) => {
				image.data[i] = dataconverter(value);
			}
		);

		return image;
	}
	static getImageHeader(pngfile) {
		let header;
		PNG160.readPNGFile(pngfile, metadata => {
			header = metadata;
		});

		return header;
	}

	static createPNG(height, width, dataputter) {
		//Add png header
		let tempdata = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		tempdata.pushAll = (array, values) => {
			values.forEach(v => {
				array.push(v);
			});
		};

		//--------------------------------------------
		//-----------------IHDR-----------------------
		//--------------------------------------------
		tempdata.pushAll(tempdata, getInt32Bytes(13)); //Length
		tempdata.pushAll(tempdata, PNG160.IHDR); //Chunk type
		tempdata.pushAll(tempdata, getInt32Bytes(width));
		tempdata.pushAll(tempdata, getInt32Bytes(height));
		tempdata.push(0x10); // bit depth
		tempdata.push(0x0); // color type
		tempdata.push(0x0); // compression method
		tempdata.push(0x0); // filter method
		tempdata.push(0x0); // interlace method
		tempdata.pushAll(tempdata, getInt32Bytes(CRC.crc32(tempdata.slice(12, 29)))); //CRC

		//--------------------------------------------
		//-----------------IDAT-----------------------
		//--------------------------------------------
		//Create data
		let imagedata = new Uint8Array(height * width * 2 + height);
		let imageindex = 0;
		for (let i = 0; i < (height + 1) * width; i++) {
			if (i % (1 + width)) {
				let value = getInt16Bytes(dataputter(width, height, i - 1 - ((i / (width + 1)) >> 0)));
				imagedata[imageindex++] = value[0];
				imagedata[imageindex++] = value[1];
			} else {
				imagedata[imageindex++] = 0;
			}
		}
		let compressed = pako.deflate(imagedata, { level: 9, windowBits: 8, strategy: 1 });

		//Create chunk
		tempdata.pushAll(tempdata, getInt32Bytes(compressed.length)); //Length
		tempdata.pushAll(tempdata, PNG160.IDAT); //Chunk type
		tempdata.pushAll(tempdata, compressed); //Data
		tempdata.pushAll(tempdata, getInt32Bytes(CRC.crc32(tempdata.slice(37, 41 + compressed.length)))); //CRC

		//--------------------------------------------
		//-----------------IEND-----------------------
		//--------------------------------------------

		tempdata.pushAll(tempdata, getInt32Bytes(0)); //Length
		tempdata.pushAll(tempdata, PNG160.IEND); //Chunk type
		tempdata.pushAll(tempdata, [0xae, 0x42, 0x60, 0x82]); //CRC
		return new Uint8Array(tempdata);
	}

	static get IHDR() {
		return new Uint8Array([0x49, 0x48, 0x44, 0x52]);
	}

	static get IDAT() {
		return new Uint8Array([0x49, 0x44, 0x41, 0x54]);
	}

	static get IEND() {
		return new Uint8Array([0x49, 0x45, 0x4e, 0x44]);
	}

	static get PNG_HEADER() {
		return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	}
}

//Filter functions
class Filters {
	constructor(array, width) {
		this.array = array;
		this.width = width;
		this.xindex = 0;
	}

	paethPredictor(a, b, c) {
		let p = a + b - c;
		let pa = Math.abs(p - a);
		let pb = Math.abs(p - b);
		let pc = Math.abs(p - c);

		if (pa <= pb && pa <= pc) return a;
		else if (pb <= pc) return b;
		else return c;
	}
	paeth(x) {
		let upperleft = 0;
		if (this.xindex != 0) {
			upperleft = this.prior(x - 2);
		}

		return this.paethPredictor(this.raw(x), this.prior(x), upperleft);
	}
	raw(x) {
		if (this.xindex != 0) {
			return this.array[x - 2];
		} else {
			return 0;
		}
	}
	prior(x) {
		return this.array[x - (this.width * 2 + 1)];
	}
	average(x) {
		return Math.floor((this.raw(x) + this.prior(x)) / 2);
	}
}

function isPng(data) {
	let ispng = true;
	data.subarray(0, 8).forEach((byte, i) => {
		ispng = byte == PNG160.PNG_HEADER[i] ? ispng : false;
	});
	return ispng;
}

//Helper methods
function getInt32Bytes(x) {
	var bytes = [];

	for (let i = 3; i >= 0; i--) {
		bytes[i] = x & 255;
		x = x >> 8;
	}
	return new Uint8Array(bytes);
}

function bytesToInt32(data, start, end) {
	var dataView = new DataView(data.buffer.slice(start, end));
	return dataView.getUint32(0);
}

function tohex(input) {
	let temp = "";
	input.forEach(element => {
		let hex = element.toString(16);
		if (hex.length == 1) {
			hex = "0" + hex;
		}
		temp += hex + " ";
	});
	temp.trim();
	return temp;
}

function bytesToInt16(data, start) {
	return data[start] * 256 + data[start + 1];
}

function getInt16Bytes(x) {
	var bytes = [];

	for (let i = 1; i >= 0; i--) {
		bytes[i] = x & 255;
		x = x >> 8;
	}
	return new Uint8Array(bytes);
}

export { PNG160 };
