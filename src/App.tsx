import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  Controller,
  SubmitErrorHandler,
  SubmitHandler,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AddCircleOutlineRounded,
  CalculateRounded,
  DeleteOutlineRounded,
  NavigateNextRounded,
} from "@mui/icons-material";

const ParticipantBase = z.object({
  name: z.string({ required_error: "Name is required." }),
  limited: z.boolean(),
  incomeType: z.enum(["hourly", "salary"]),
});

const Participant = z.discriminatedUnion("incomeType", [
  ParticipantBase.extend({
    incomeType: z.literal("hourly"),
    hourlyRate: z.coerce
      .number()
      .gt(0, "Hourly rate must be greater than zero."),
    hoursPerWeek: z.coerce
      .number()
      .gt(0, "Hours worked per week must be greater than zero.")
      .lt(24 * 7, "There are only 168 hours in a week..."),
  }),
  ParticipantBase.extend({
    incomeType: z.literal("salary"),
    annualSalary: z.coerce
      .number()
      .gt(0, "Annual salary must be greater than zero."),
  }),
]);

type Participant = z.infer<typeof Participant>;

const BillPay = z.object({
  amount: z.coerce.number().gt(0, "Bill amount must be greater than zero."),
  maximumLimit: z.coerce.number(),
  minimumLimit: z.coerce.number(),
  participants: Participant.array(),
});

type BillPay = z.infer<typeof BillPay>;

type RelevantInfo = {
  grossMonthlyIncome: number;
  percentageOfTotal: number;
  amountDue: number;
  adjustedDue: number;
};

const STEPS = ["Settings", "Participants", "Result"];

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<{
    [k: number]: boolean;
  }>({});

  const [results, setResults] = useState<RelevantInfo[]>([]);
  const [totalGross, setTotalGross] = useState(0);

  const { handleSubmit, control, getValues, setValue, watch } =
    useForm<BillPay>({
      defaultValues: {
        amount: 0,
        maximumLimit: 600,
        minimumLimit: 200,
        participants: [
          {
            name: "Participant 1",
            incomeType: "salary",
            limited: false,
            annualSalary: 30000,
          },
          {
            name: "Participant 2",
            incomeType: "hourly",
            limited: false,
            hourlyRate: 15,
            hoursPerWeek: 40,
          },
        ],
      },
      resolver: zodResolver(BillPay),
    });

  const onValid: SubmitHandler<BillPay> = (data) => {
    // Each participants monthly gross income
    const participantMonthlyGross = data.participants.map((participant) => {
      if (participant.incomeType === "hourly") {
        return participant.hourlyRate * participant.hoursPerWeek * 4;
      } else {
        return participant.annualSalary / 12;
      }
    });

    // Count of participants who are not limited
    const nonLimitedParticipantCount = data.participants.filter(
      (participant) => !participant.limited
    ).length;

    // Total gross income
    const totalGross = participantMonthlyGross.reduce(
      (acc, income) => acc + income,
      0
    );

    // Each participants percentage of income relative to the total
    const incomePercentages = participantMonthlyGross.map(
      (income) => (income / totalGross) * 100
    );

    // Calculate the amount each participant should pay without limits
    const nonLimitedDues = participantMonthlyGross.map((_income, index) => {
      const percentage = incomePercentages[index];
      return data.amount * (percentage / 100);
    });

    // The difference between the total amount due and the total amount paid
    // after limits are enforced. A positive value indicates an outstanding
    // balance, while a negative value indicates an overpayment.
    let deltaBalance = 0;

    // Apply limits
    const limitedDues = nonLimitedDues.map((due, index) => {
      const participant = data.participants[index];
      if (participant.limited) {
        const max = data.maximumLimit || 0;
        const min = data.minimumLimit || 0;
        if (max && due > max) {
          deltaBalance += due - max;
          return max;
        } else if (min && due < min) {
          deltaBalance += due - min;
          return min;
        } else {
          return due;
        }
      } else {
        return due;
      }
    });

    const adjustedDues = limitedDues.map((due, index) => {
      const participant = data.participants[index];
      if (!participant.limited) {
        return due + deltaBalance / nonLimitedParticipantCount;
      } else {
        return due;
      }
    });

    setTotalGross(totalGross);
    setResults(
      data.participants.map((_participant, index) => {
        return {
          grossMonthlyIncome: participantMonthlyGross[index],
          percentageOfTotal: incomePercentages[index],
          amountDue: nonLimitedDues[index],
          adjustedDue: adjustedDues[index],
        };
      })
    );

    setCompleted({ 0: true, 1: true });
    setActiveStep(2);
  };

  const onInvalid: SubmitErrorHandler<BillPay> = (errors) => {
    if (errors.amount || errors.maximumLimit || errors.minimumLimit)
      setActiveStep(0);
  };

  return (
    <Container>
      <Typography variant="h1">Rent Shares</Typography>
      <Box component="form" onSubmit={handleSubmit(onValid, onInvalid)}>
        <Stepper nonLinear activeStep={activeStep}>
          {STEPS.map((label, index) => (
            <Step key={label} completed={completed[index]}>
              <StepButton
                disabled={index === 2 && (!completed[0] || !completed[1])}
                color="inherit"
                onClick={() => setActiveStep(index)}
              >
                {label}
              </StepButton>
            </Step>
          ))}
        </Stepper>
        <Box sx={{ display: activeStep === 0 ? "block" : "none", padding: 5 }}>
          <Stack direction="row" gap={2}>
            <Controller
              name="amount"
              control={control}
              render={({ field, fieldState }) => {
                console.log(fieldState.error);
                return (
                  <TextField
                    {...field}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                    label={
                      <Tooltip title="The total amount due each month.">
                        <label>Amount Due</label>
                      </Tooltip>
                    }
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      },
                    }}
                  />
                );
              }}
            />
            <Controller
              name="minimumLimit"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={
                    <Tooltip title="The minimum amount a participant who is subject to the limits can pay.">
                      <label>Minimum Limit</label>
                    </Tooltip>
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
            <Controller
              name="maximumLimit"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={
                    <Tooltip title="The maximum amount a participant who is subject to the limits can pay.">
                      <label>Maximum Limit</label>
                    </Tooltip>
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
            <Button
              endIcon={<NavigateNextRounded />}
              onClick={() => setActiveStep(1)}
              sx={{ marginLeft: "auto" }}
            >
              Next
            </Button>
          </Stack>
        </Box>
        <Box sx={{ display: activeStep === 1 ? "block" : "none", padding: 5 }}>
          <Stack gap={2}>
            {watch("participants").map((participant, index) => (
              <Stack key={index} gap={2} marginBottom={5}>
                <Typography variant="h4">Participant {index + 1}</Typography>
                <Controller
                  name={`participants.${index}.name`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      error={Boolean(fieldState.error)}
                      helperText={fieldState.error?.message}
                      label="Name"
                    />
                  )}
                />
                <Stack direction="row" gap={2}>
                  <Controller
                    name={`participants.${index}.limited`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} />}
                        label="Enforce Limits"
                      />
                    )}
                  />
                  <Controller
                    name={`participants.${index}.incomeType`}
                    control={control}
                    render={({ field }) => (
                      <TextField select {...field} label="Income Type">
                        <MenuItem value="hourly">Hourly</MenuItem>
                        <MenuItem value="salary">Salary</MenuItem>
                      </TextField>
                    )}
                  />
                  {participant.incomeType === "hourly" ? (
                    <>
                      <Controller
                        name={`participants.${index}.hourlyRate`}
                        control={control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            error={Boolean(fieldState.error)}
                            helperText={fieldState.error?.message}
                            label="Hourly Rate"
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    $
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        )}
                      />
                      <Controller
                        name={`participants.${index}.hoursPerWeek`}
                        control={control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            error={Boolean(fieldState.error)}
                            helperText={fieldState.error?.message}
                            label="Hours Per Week"
                          />
                        )}
                      />
                    </>
                  ) : (
                    <Controller
                      name={`participants.${index}.annualSalary`}
                      control={control}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          error={Boolean(fieldState.error)}
                          helperText={fieldState.error?.message}
                          label="Annual Salary"
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  $
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      )}
                    />
                  )}
                  <IconButton
                    aria-label="Delete Participant"
                    color="error"
                    onClick={() => {
                      const participants = getValues("participants");
                      setValue(
                        "participants",
                        participants.filter((_, i) => i !== index)
                      );
                    }}
                    sx={{ aspectRatio: 1 / 1 }}
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
            <Stack direction="row" gap={2}>
              <Button
                color="success"
                onClick={() => {
                  const participants = getValues("participants");
                  setValue(`participants.${participants.length}`, {
                    name: `Participant ${participants.length + 1}`,
                    incomeType: "salary",
                    limited: false,
                    annualSalary: 0,
                  });
                }}
                startIcon={<AddCircleOutlineRounded />}
                sx={{ alignItems: "center", flexGrow: 1 }}
              >
                Add Participant
              </Button>
              <Button
                startIcon={<CalculateRounded />}
                sx={{ alignItems: "center", flexGrow: 1 }}
                type="submit"
              >
                Calculate
              </Button>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ display: activeStep === 2 ? "block" : "none", padding: 5 }}>
          <Stack gap={2}>
            <Typography variant="h3">
              Household Gross Income:{" "}
              <strong>{formatDollarAmount(totalGross)}</strong>
            </Typography>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Gross Income</TableCell>
                    <TableCell align="right">Percentage</TableCell>
                    <TableCell align="right">Unadjusted Due</TableCell>
                    <TableCell align="right">Adjusted Due</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow
                      key={index}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {getValues(`participants.${index}.name`)}
                      </TableCell>
                      <TableCell align="right">
                        {formatDollarAmount(result.grossMonthlyIncome)}
                      </TableCell>
                      <TableCell align="right">
                        {result.percentageOfTotal.toFixed(2)}%
                      </TableCell>
                      <TableCell align="right">
                        {formatDollarAmount(result.amountDue)}
                      </TableCell>
                      <TableCell align="right">
                        {formatDollarAmount(result.adjustedDue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
}

export default App;

function formatDollarAmount(amount: number) {
  return "$" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
