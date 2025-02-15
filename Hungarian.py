import os
import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment


def generate_file_names(prefixes, num_files_per_prefix):
    """
    Generates a list of file names based on prefixes and number of files per prefix.

    Args:
        prefixes (list): List of file prefixes (e.g., "Te_3648", "FUE_database_3648").
        num_files_per_prefix (int): Number of files to generate for each prefix.

    Returns:
        list: List of generated file names.
    """
    file_names = []
    for prefix in prefixes:
        for i in range(1, num_files_per_prefix + 1):
            file_names.append(f"{prefix}_{i}.csv")
    return file_names


# Prefix lists
gain_files_prefixes = [
    "Te_matrices/Te_3648", "Te_matrices/Te_3654", "Te_matrices/Te_3660",
    "Te_matrices/Te_3666", "Te_matrices/Te_3672", "Te_matrices/Te_3678",
    "Te_matrices/Te_3684", "Te_matrices/Te_3690", "Te_matrices/Te_3696",
    "Te_matrices/Te_36102", "Te_matrices/Te_36108", "Te_matrices/Te_36114",
    "Te_matrices/Te_36120"
]
financial_benefit_files_prefixes = [
    "FUE_Bid_Files/FUE_database_3648", "FUE_Bid_Files/FUE_database_3654",
    "FUE_Bid_Files/FUE_database_3660", "FUE_Bid_Files/FUE_database_3666",
    "FUE_Bid_Files/FUE_database_3672", "FUE_Bid_Files/FUE_database_3678",
    "FUE_Bid_Files/FUE_database_3684", "FUE_Bid_Files/FUE_database_3690",
    "FUE_Bid_Files/FUE_database_3696", "FUE_Bid_Files/FUE_database_36102",
    "FUE_Bid_Files/FUE_database_36108", "FUE_Bid_Files/FUE_database_36114",
    "FUE_Bid_Files/FUE_database_36120"
]

# Number of files per prefix
num_files_per_prefix = 500

# Generate file names
gain_files = generate_file_names(gain_files_prefixes, num_files_per_prefix)
financial_benefit_files = generate_file_names(financial_benefit_files_prefixes,
                                              num_files_per_prefix)

# Parameters for weighted combination
precision = 2
bid_multiplier = 1
alpha = 1.00  # Weight for financial benefit
beta = round(1 - alpha, precision)  # Weight for gain

# Dictionary to accumulate optimal gains
optimal_objectives = {}
totalBenefits = {}
totalGains = {}

# Loop through each pair of gain and financial benefit CSV files
for gain_file, benefit_file in zip(gain_files, financial_benefit_files):
    print("gain_file  ::::: ", gain_file)
    print("benefit_file   :::::", benefit_file)
    # Load the gain data
    gain_df = pd.read_csv(gain_file, header=0, index_col=0)
    gain_matrix = gain_df.to_numpy()
    # gain_matrix = (gain_matrix - gain_matrix.min()) / (gain_matrix.max() - gain_matrix.min())

    # Load and normalize benefit data
    benefit_df = pd.read_csv(benefit_file)
    benefit_array = benefit_df['Bid'].values
    # benefit_array = (benefit_array - benefit_array.min()) / (benefit_array.max() - benefit_array.min())
    n_secondary = gain_matrix.shape[0]
    n_primary = gain_matrix.shape[1]
    benefit_matrix = np.tile(benefit_array, (n_primary, 1)).T
    W = alpha * benefit_matrix + beta * gain_matrix

    # Extend the weight matrix to make it square by adding dummy columns if necessary
    if n_secondary > n_primary:
        dummy_columns = np.zeros((n_secondary, n_secondary - n_primary))
        W_extended = np.hstack([W, dummy_columns])
    else:
        W_extended = W

    # Apply the Hungarian Algorithm
    row_ind, col_ind = linear_sum_assignment(-W_extended)

    # Filter out dummy column assignments (those with column index >= n_primary)
    valid_pairs = [(r, c) for r, c in zip(row_ind, col_ind) if c < n_primary]

    # Calculate the optimal gain for the current file
    optimal_gain = sum(W[r, c] for r, c in valid_pairs)
    # gain_sum = sum(W[r, c] for r, c in valid_pairs)
    # print("gain_sum", gain_sum)
    # benefit_sum = sum(benefit_matrix[c] for r, c in valid_pairs)
    # total_weighted_sum = alpha * benefit_sum + beta * optimal_gain
    # print("valid_pairs", valid_pairs)
    totalBenefit = 0
    totalGain = 0
    for r, c in valid_pairs:
        # print("r", r)
        # print("c", c)
        # print("benefit_array[r]", benefit_array[r])
        # print("gain_matrix", gain_matrix[r,c])
        totalBenefit += benefit_array[r]
        totalGain = gain_matrix[r, c]

    # print("manual total", total)
    # print("optimal_gain", optimal_gain)

    # Save the optimal gain in the dictionary
    optimal_objectives[os.path.basename(gain_file)] = optimal_gain
    totalBenefits[os.path.basename(gain_file)] = totalBenefit
    totalGains[os.path.basename(gain_file)] = totalGain

    # Create a dictionary to map primary users to their corresponding secondary users based on the optimal pairs
    primary_to_secondary = {
        prim_user + 1: sec_user + 1
        for sec_user, prim_user in valid_pairs
    }

    # Convert the dictionary into a DataFrame for a CSV-friendly format
    primary_secondary_df = pd.DataFrame.from_dict(primary_to_secondary,
                                                  orient='index',
                                                  columns=['Secondary User'])
    primary_secondary_df.index.name = 'Primary User'

    # Sort the DataFrame by 'Primary User' index
    primary_secondary_df.sort_index(inplace=True)

    # Save the individual optimal pairings to an output CSV file
    output_file = f'./newOutPut/optimal_pairings_{os.path.splitext(os.path.basename(gain_file))[0]}.csv'
    primary_secondary_df.to_csv(output_file)

    print(f"Optimal pairings for {gain_file} have been saved to {output_file}")
    print(f"Optimal Combined Objective Value for {gain_file}: {optimal_gain}")

# After processing all files, save the accumulated optimal gains to a summary CSV file
summary_df = pd.DataFrame(list(optimal_objectives.items()),
                          columns=['CSV_File', 'Optimal_Gain'])
summary_df.to_csv(
    f'./HungarianCSV/Hungarian_alpha{alpha:.2f}_beta{beta:.2f}OptimalGains.csv',
    index=False)

summary_df = pd.DataFrame(list(totalBenefits.items()),
                          columns=['CSV_File', 'Optimal_Gain'])
summary_df.to_csv(
    f'./HungarianCSVBenefit/Hungarian_alpha{alpha:.2f}_beta{beta:.2f}OptimalGains.csv',
    index=False)

summary_df = pd.DataFrame(list(totalGains.items()),
                          columns=['CSV_File', 'Optimal_Gain'])
summary_df.to_csv(
    f'./HungarianCSVGain/Hungarian_alpha{alpha:.2f}_beta{beta:.2f}OptimalGains.csv',
    index=False)

print(
    "All optimal gains have been accumulated and saved to 'optimal_gains_summary.csv'"
)
