const csv = require('csvtojson');
const _ = require('lodash');
const { Parser } = require('json2csv');
const fs = require('fs');

async function main() {
	function generateFileNames(prefixes, numFilesPerPrefix) {
		/**
		 * Generates a list of file names based on prefixes and number of files per prefix.
		 * 
		 * @param {Array} prefixes - List of file prefixes (e.g., "Te_3648", "FUE_database_3648").
		 * @param {Number} numFilesPerPrefix - Number of files to generate for each prefix.
		 * @returns {Array} List of generated file names.
		 */
		const fileNames = [];
		prefixes.forEach(prefix => {
			for (let i = 1; i <= numFilesPerPrefix; i++) {
				fileNames.push(`${prefix}_${i}.csv`);
			}
		});
		return fileNames;
	}
	
	// Prefix lists
	const gainFilesPrefixes = [
		"Te_matrices/Te_3648", "Te_matrices/Te_3654", "Te_matrices/Te_3660", "Te_matrices/Te_3666", "Te_matrices/Te_3672", "Te_matrices/Te_3678",
		"Te_matrices/Te_3684", "Te_matrices/Te_3690", "Te_matrices/Te_3696", "Te_matrices/Te_36102", "Te_matrices/Te_36108", "Te_matrices/Te_36114",
		"Te_matrices/Te_36120"
	];
	
	const financialBenefitFilesPrefixes = [
		"FUE_Bid_Files/FUE_database_3648", "FUE_Bid_Files/FUE_database_3654", "FUE_Bid_Files/FUE_database_3660", "FUE_Bid_Files/FUE_database_3666", 
		"FUE_Bid_Files/FUE_database_3672", "FUE_Bid_Files/FUE_database_3678", "FUE_Bid_Files/FUE_database_3684", "FUE_Bid_Files/FUE_database_3690", 
		"FUE_Bid_Files/FUE_database_3696", "FUE_Bid_Files/FUE_database_36102", "FUE_Bid_Files/FUE_database_36108", "FUE_Bid_Files/FUE_database_36114", 
		"FUE_Bid_Files/FUE_database_36120"
	];
	
	// Number of files per prefix
	const numFilesPerPrefix = 500;
	
	// Generate file names
	const tePaths = generateFileNames(gainFilesPrefixes, numFilesPerPrefix);
	const fuePaths = generateFileNames(financialBenefitFilesPrefixes, numFilesPerPrefix);
	
	// Example: Print the first 10 file names for each type
	console.log("Gain Files:", tePaths.slice(0, 10)); // Print first 10 gain files
	console.log("Financial Benefit Files:", fuePaths.slice(0, 10)); // Print first 10 financial benefit files
	

    // All the arrays and configuration remain the same
	const num_FBS = [6,6,6,6,6,6,6,6,
		6,6,6,6,6,6,6,6,
		6,6,6,6,6,6,6,6,
		6,6,6,6,6,6,6,6,
		6,6,6,6,6,6,6,6
	];
	const num_MUE = [36,36,36,36,36,36,36,36,
		36,36,36,36,36,36,36,36,
		36,36,36,36,36,36,36,36,
		36,36,36,36,36,36,36,36,
		36,36,36,36,36,36,36,36
	];
	const num_FUE = [48,54,60,66,72,78,84,90,
		48,54,60,66,72,78,84,90,
		48,54,60,66,72,78,84,90,
		48,54,60,66,72,78,84,90,
		48,54,60,66,72,78,84,90
	];

    const bidMultiplier = 1;
    const precision = 2;
    const alpha = 0.30; // weight of bid
    const betta = (1 - alpha).toFixed(precision);
                
    let optimalGains = {};
    
    for (let i = 0; i < fuePaths.length ; i++) {
		console.log(i)
        const csvFueFilePath = fuePaths[i];
        const csvTeFilePath = tePaths[i];
        const matches = csvTeFilePath.match(/(\d+)_(\d+)\.csv$/);
        const iter = matches ? parseInt(matches[2]) : null;

		const match = csvTeFilePath.match(/Te_(\d{2})(\d{2})_\d+/);
        const lengthFueList = parseInt(match[2], 10);
        const lengthMueList = parseInt(match[1], 10);

        const dataFue = await csv().fromFile(csvFueFilePath);

        const fBSToFueList = dataFue.reduce((acc, person) => {
            if (!acc[person.FBS]) {
                acc[person.FBS] = [];
            }
            acc[person.FBS].push(parseInt(person.FUE_ID.substring(4)));
            return acc;
        }, {});

        const dataTe = await csv().fromFile(csvTeFilePath);

        let sortedFue = {};
        for (let i = 0; i < lengthFueList; i++) {
            let entries = Object.entries(dataTe[i]);
            entries.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
            entries.shift();
            sortedFue[i+1] = entries;
        }

		// console.log("sorted fue", sortedFue)

        const calculateAverage = (data) => {
            const result = {};
            for (const key in data) {
                const values = data[key].map(item => parseFloat(item[1]));
                const sum = values.reduce((acc, val) => acc + val, 0);
                const average = sum / values.length;
                dataFue[key-1].avgSNR = average;
                dataFue[key-1].qualityFactor = alpha * dataFue[key-1].Bid * bidMultiplier + betta * average;
                result[key] = alpha * dataFue[key-1].Bid * bidMultiplier + betta * average;
            }
            return result;
        };

        const quality = calculateAverage(sortedFue);
        const qualitySorted = Object.entries(quality)
            .sort(([, a], [, b]) => b - a);

        ///////////// Used for Normalisation
					// const calculateAverage = (data, dataFue) => {
					// 	// First get all gain values and bids for global normalization
					// 	let allGains = [];
					// 	for (const key in data) {
					// 		const values = data[key].map(item => parseFloat(item[1]));
					// 		allGains = allGains.concat(values);
					// 	}
						
					// 	// Find global min/max for gains
					// 	const minGain = Math.min(...allGains);
					// 	const maxGain = Math.max(...allGains);
						
					// 	// Get all bids for global normalization
					// 	const allBids = dataFue.map(item => parseFloat(item.Bid));
					// 	const minBid = Math.min(...allBids);
					// 	const maxBid = Math.max(...allBids);
					
					// 	const result = {};
					// 	for (const key in data) {
					// 		// Normalize gains for this FUE
					// 		const gains = data[key].map(item => parseFloat(item[1]));
					// 		const normalizedGains = gains.map(gain => 
					// 			(gain - minGain) / (maxGain - minGain)
					// 		);
							
					// 		// Calculate average of normalized gains
					// 		const avgNormalizedGain = normalizedGains.reduce((sum, val) => sum + val, 0) / normalizedGains.length;
							
					// 		// Normalize bid
					// 		const normalizedBid = (parseFloat(dataFue[key-1].Bid) - minBid) / (maxBid - minBid);
							
					// 		// Store original and normalized values for reference
					// 		dataFue[key-1].originalGain = gains;
					// 		dataFue[key-1].normalizedGains = normalizedGains;
					// 		dataFue[key-1].normalizedAvgGain = avgNormalizedGain;
					// 		dataFue[key-1].normalizedBid = normalizedBid;
							
					// 		// Calculate quality factor using normalized values
					// 		const qualityFactor = alpha * normalizedBid + betta * avgNormalizedGain;
					// 		result[key] = qualityFactor;
					// 	}
					// 	return {
					// 		qualityFactors: result,
					// 		minGain,
					// 		maxGain
					// 	};
					// };
					
					// const quality = calculateAverage(sortedFue, dataFue);
					// const qualitySorted = Object.entries(quality)
					// 	.sort(([, a], [, b]) => b - a);

					// const { qualityFactors, minGain, maxGain } = calculateAverage(sortedFue, dataFue);
					// const qualitySorted = Object.entries(qualityFactors)
					// .sort(([, a], [, b]) => b - a);

					// let totalNormalizedGain = 0;
					// for (const fue in resourceMap) {
					// 	const fueIndex = parseInt(fue.split(' ')[1])-1;
					// 	const mueKey = resourceMap[fue];
					// 	const rawGain = parseFloat(dataTe[fueIndex][mueKey]);
					// 	const normalizedGain = (rawGain - minGain) / (maxGain - minGain);
					// 	totalNormalizedGain += normalizedGain;
					// }
					// optimalGains[`Te_${lengthMueList}${lengthFueList}_${iter}.csv`] = totalNormalizedGain;
		//////////////////////////////////////////////////////////////
		
		const soldListOfMue = [];
        const resourceMap = {};
        
        for (let i = 0; i < qualitySorted.length; i++) {
            for (const item of sortedFue[qualitySorted[i][0]]) {
                if(!soldListOfMue.includes(item[0])) {
                    resourceMap["fue " + qualitySorted[i][0]] = item[0];
                    soldListOfMue.push(item[0]);
                    break;
                }
            }
        }


        let totalChannelGain = 0;
        for (const fue in resourceMap) {
            totalChannelGain += parseFloat(dataTe[parseInt(fue.split(' ')[1])-1][resourceMap[fue]]);
        }

        optimalGains[`Te_${lengthMueList}${lengthFueList}_${iter}.csv`] = totalChannelGain;
        const myData = Object.entries(resourceMap).map(([fue, MUE]) => ({ fue, MUE }));
        
        let myDataSorted = myData.sort((a, b) => {
            const fueA = parseInt(a.fue.split(' ')[1]);
            const fueB = parseInt(b.fue.split(' ')[1]);
            return fueA - fueB;
        });

        const fields = ['fue', 'MUE'];
        const opts = { fields };

		console.log("lengthFueList", lengthFueList)
		console.log("iter", iter)
		console.log("totalChannelGain", totalChannelGain)

        try {
            const parser = new Parser(opts);
            const csv = parser.parse(myDataSorted);
            fs.writeFileSync(`./winnerSelection/output_${lengthMueList}${lengthFueList}_${iter}.csv`, csv);
        } catch (err) {
            console.error(err);
        }
    }

    const fields = ['CSV_File', 'Optimal_Gain'];
    const optsOptimal = { fields };
    const parserOptimalGains = new Parser(optsOptimal);

    const optimalGainsArray = Object.entries(optimalGains).map(([key, value]) => ({
        CSV_File: key,
        Optimal_Gain: value,
    }));

    const csvOptimalGains = parserOptimalGains.parse(optimalGainsArray);
    fs.writeFileSync(`FinalWinnerSelection/alpha${alpha.toFixed(precision)}_beta${parseFloat(betta).toFixed(precision)}OptimalGains.csv`, csvOptimalGains);
}

main()
    .then(() => {
        console.log('Processing completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('An error occurred:', error);
        process.exit(1);
    });